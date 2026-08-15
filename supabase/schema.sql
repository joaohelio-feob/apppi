-- =====================================================================
-- PI 2026 · Painel da equipe
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez só).
-- =====================================================================

-- ---------- 1. MEMBROS ------------------------------------------------
create table if not exists membros (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  papel      text not null default 'dev',   -- dev | doc | scrum | design
  criado_em  timestamptz not null default now()
);

-- Cria o registro de membro automaticamente quando alguém se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.membros (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. TAREFAS ------------------------------------------------
create table if not exists tarefas (
  id             bigserial primary key,
  titulo         text not null,
  descricao      text,
  responsavel_id uuid references membros(id) on delete set null,
  criador_id     uuid references membros(id) on delete set null,
  status         text not null default 'pendente',   -- pendente | fazendo | revisao | concluida
  prioridade     text not null default 'media',      -- baixa | media | alta
  unidade        text not null default 'geral',      -- poo | modelagem | logica | bi | autoconhecimento | geral
  inicio         date,
  prazo          date,
  local_entrega  text,                               -- link onde a atividade foi/será entregue (GitHub, Drive, Forms...)
  issue_numero   integer,                            -- número da issue no repositório (só leitura via API do GitHub)
  observacoes    text,                               -- notas de quem entregou a atividade
  subiu_git      boolean not null default false,      -- a entrega já está versionada no repositório?
  arquivada      boolean not null default false,      -- arquivada em vez de apagada: a trilha não pode sumir
  concluido_em   timestamptz,                         -- preenchido sozinho quando o status vira "concluida"
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_tarefas_prazo on tarefas(prazo);
create index if not exists idx_tarefas_responsavel on tarefas(responsavel_id);

-- ---------- 2b. ANEXOS -------------------------------------------------
-- Documentos anexados na entrega de uma tarefa. Os arquivos em si ficam
-- no Storage (bucket "entregas"); aqui só fica a referência.
create table if not exists anexos (
  id         bigserial primary key,
  tarefa_id  bigint not null references tarefas(id) on delete cascade,
  autor_id   uuid references membros(id) on delete set null,
  nome       text not null,
  caminho    text not null,   -- caminho do arquivo no bucket "entregas"
  criado_em  timestamptz not null default now()
);

create index if not exists idx_anexos_tarefa on anexos(tarefa_id);

-- ---------- 2c. REUNIÕES -----------------------------------------------
-- Ata mínima: quando foi, o que pautou, quem estava e o que ficou decidido.
-- O documento do PI cobra registro de reunião com ajustes e desafios.
create table if not exists reunioes (
  id         bigserial primary key,
  data       date not null,
  pauta      text not null,
  presentes  uuid[] not null default '{}',
  decisoes   text,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_reunioes_data on reunioes(data desc);

alter table reunioes enable row level security;

create policy "equipe le reunioes"  on reunioes for select to authenticated using (true);
create policy "equipe cria reunioes" on reunioes for insert to authenticated with check (true);
create policy "equipe edita reunioes" on reunioes for update to authenticated using (true);
-- Sem policy de DELETE, mesmo raciocínio de tarefas: reunião registrada não some.

-- ---------- 3. HISTÓRICO (a prova para o professor) -------------------
-- Só recebe INSERT. Nunca apague nada daqui.
create table if not exists historico (
  id           bigserial primary key,
  tarefa_id    bigint references tarefas(id) on delete cascade,
  autor_id     uuid references membros(id) on delete set null,
  acao         text not null,        -- criou | mudou_status | reatribuiu | mudou_prazo | editou | mudou_git | arquivou | desarquivou | removeu
  campo        text,
  valor_antigo text,
  valor_novo   text,
  em           timestamptz not null default now()
);

create index if not exists idx_historico_em on historico(em desc);

-- ---------- 4. TRIGGER: registra tudo sozinho -------------------------
create or replace function public.registrar_historico()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into historico (tarefa_id, autor_id, acao, campo, valor_novo)
    values (new.id, auth.uid(), 'criou', 'titulo', new.titulo);
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if new.status is distinct from old.status then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'mudou_status', 'status', old.status, new.status);
      new.concluido_em := case when new.status = 'concluida' then now() else null end;
      if new.status = 'fazendo' and old.inicio is null then
        new.inicio := (now() at time zone 'America/Sao_Paulo')::date;
      end if;
    end if;

    if new.responsavel_id is distinct from old.responsavel_id then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'reatribuiu', 'responsavel_id',
              old.responsavel_id::text, new.responsavel_id::text);
    end if;

    if new.prazo is distinct from old.prazo then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'mudou_prazo', 'prazo', old.prazo::text, new.prazo::text);
    end if;

    if new.titulo is distinct from old.titulo or new.descricao is distinct from old.descricao then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'titulo', old.titulo, new.titulo);
    end if;

    if new.observacoes is distinct from old.observacoes then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'observacoes', old.observacoes, new.observacoes);
    end if;

    if new.subiu_git is distinct from old.subiu_git then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'mudou_git', 'subiu_git', old.subiu_git::text, new.subiu_git::text);
    end if;

    if new.arquivada is distinct from old.arquivada then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), case when new.arquivada then 'arquivou' else 'desarquivou' end,
              'arquivada', old.arquivada::text, new.arquivada::text);
    end if;

    if new.unidade is distinct from old.unidade then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'unidade', old.unidade, new.unidade);
    end if;

    if new.issue_numero is distinct from old.issue_numero then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'issue_numero', old.issue_numero::text, new.issue_numero::text);
    end if;

    new.atualizado_em := now();
    return new;
  end if;

  if (tg_op = 'DELETE') then
    -- Não existe mais policy de DELETE pra authenticated (ver seção 5): a equipe
    -- arquiva, não apaga. Isso só roda se alguém excluir direto pelo SQL Editor
    -- como administrador — fica registrado mesmo assim.
    insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo)
    values (null, auth.uid(), 'removeu', 'titulo', old.titulo);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_hist_ins on tarefas;
create trigger trg_hist_ins after insert on tarefas
  for each row execute function public.registrar_historico();

drop trigger if exists trg_hist_upd on tarefas;
create trigger trg_hist_upd before update on tarefas
  for each row execute function public.registrar_historico();

drop trigger if exists trg_hist_del on tarefas;
create trigger trg_hist_del before delete on tarefas
  for each row execute function public.registrar_historico();

-- ---------- 5. RLS: só a equipe logada enxerga -------------------------
alter table membros   enable row level security;
alter table tarefas   enable row level security;
alter table historico enable row level security;
alter table anexos    enable row level security;

create policy "equipe le membros"   on membros   for select to authenticated using (true);
create policy "membro edita a si"   on membros   for update to authenticated using (auth.uid() = id);

create policy "equipe le tarefas"   on tarefas   for select to authenticated using (true);
create policy "equipe cria tarefas" on tarefas   for insert to authenticated with check (true);
create policy "equipe edita tarefas"on tarefas   for update to authenticated using (true);
-- Sem policy de DELETE: a equipe arquiva (arquivada = true), nunca apaga.
-- É o que mantém a trilha de histórico íntegra.

create policy "equipe le historico" on historico for select to authenticated using (true);
-- Repare: não existe policy de UPDATE nem DELETE em historico. É proposital.

create policy "equipe le anexos"      on anexos for select to authenticated using (true);
create policy "equipe anexa"          on anexos for insert to authenticated with check (true);
create policy "autor apaga seu anexo" on anexos for delete to authenticated using (auth.uid() = autor_id);

-- ---------- 5b. STORAGE: bucket privado para os documentos anexados ---
insert into storage.buckets (id, name, public)
values ('entregas', 'entregas', false)
on conflict (id) do nothing;

create policy "equipe le arquivos de entregas" on storage.objects
  for select to authenticated using (bucket_id = 'entregas');

create policy "equipe sobe arquivos de entregas" on storage.objects
  for insert to authenticated with check (bucket_id = 'entregas');

create policy "autor apaga seu arquivo" on storage.objects
  for delete to authenticated using (bucket_id = 'entregas' and owner = auth.uid());

-- ---------- 6. VIEW pronta para o relatório final ---------------------
create or replace view relatorio_atividades as
select
  h.em,
  m.nome  as autor,
  m.papel,
  h.acao,
  h.campo,
  h.valor_antigo,
  h.valor_novo,
  t.titulo as tarefa,
  t.status as status_atual
from historico h
left join membros m on m.id = h.autor_id
left join tarefas t on t.id = h.tarefa_id
order by h.em desc;

-- =====================================================================
-- MIGRAÇÃO · arquivar em vez de apagar + coluna de unidade (rode só se já
-- executou este arquivo antes de agosto/2026). Se está criando o projeto
-- do zero, ignore este bloco — as seções acima já vêm com tudo certo.
-- =====================================================================

-- 1. Novas colunas, sem quebrar quem já tem tarefas cadastradas.
alter table tarefas add column if not exists arquivada boolean not null default false;
alter table tarefas add column if not exists unidade text not null default 'geral';
alter table tarefas add column if not exists issue_numero integer;

-- 2. Tira a permissão de apagar tarefa. Dali pra frente só dá pra arquivar.
drop policy if exists "equipe apaga tarefas" on tarefas;

-- 3. Recria a função do trigger com a lógica de arquivar/desarquivar/unidade
--    (mesmo corpo da seção 4 acima — rodar de novo só substitui a versão antiga).
create or replace function public.registrar_historico()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into historico (tarefa_id, autor_id, acao, campo, valor_novo)
    values (new.id, auth.uid(), 'criou', 'titulo', new.titulo);
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if new.status is distinct from old.status then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'mudou_status', 'status', old.status, new.status);
      new.concluido_em := case when new.status = 'concluida' then now() else null end;
      if new.status = 'fazendo' and old.inicio is null then
        new.inicio := (now() at time zone 'America/Sao_Paulo')::date;
      end if;
    end if;

    if new.responsavel_id is distinct from old.responsavel_id then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'reatribuiu', 'responsavel_id',
              old.responsavel_id::text, new.responsavel_id::text);
    end if;

    if new.prazo is distinct from old.prazo then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'mudou_prazo', 'prazo', old.prazo::text, new.prazo::text);
    end if;

    if new.titulo is distinct from old.titulo or new.descricao is distinct from old.descricao then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'titulo', old.titulo, new.titulo);
    end if;

    if new.observacoes is distinct from old.observacoes then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'observacoes', old.observacoes, new.observacoes);
    end if;

    if new.subiu_git is distinct from old.subiu_git then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'mudou_git', 'subiu_git', old.subiu_git::text, new.subiu_git::text);
    end if;

    if new.arquivada is distinct from old.arquivada then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), case when new.arquivada then 'arquivou' else 'desarquivou' end,
              'arquivada', old.arquivada::text, new.arquivada::text);
    end if;

    if new.unidade is distinct from old.unidade then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'unidade', old.unidade, new.unidade);
    end if;

    if new.issue_numero is distinct from old.issue_numero then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'issue_numero', old.issue_numero::text, new.issue_numero::text);
    end if;

    new.atualizado_em := now();
    return new;
  end if;

  if (tg_op = 'DELETE') then
    insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo)
    values (null, auth.uid(), 'removeu', 'titulo', old.titulo);
    return old;
  end if;

  return null;
end;
$$;
