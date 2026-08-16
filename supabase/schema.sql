-- =====================================================================
-- PI 2026 · Painel da equipe
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez só).
-- =====================================================================

-- ---------- 0. FRENTES -------------------------------------------------
-- Sub-time do projeto (ex.: Frontend, Backend, Design...). Cada integrante
-- pertence a uma frente só; uma frente de uma pessoa só é só uma frente
-- com um membro — não tem caso especial pra isso.
create table if not exists frentes (
  id         bigserial primary key,
  nome       text not null,
  unidade    text,      -- poo | modelagem | logica | bi | autoconhecimento — liga a frente
                        -- à unidade de estudo do PI, prova pro professor que todas foram trabalhadas
  cor        text not null default 'ferro' constraint frentes_cor_check
             check (cor in ('musgo', 'trigo', 'broto', 'ferro')),
                        -- token do tema, nunca hexadecimal (ver lib/types.ts CLASSES_COR_FRENTE)
  ordem      int  not null default 0,      -- ordem de exibição em /frentes
  criado_em  timestamptz not null default now()
);

-- ---------- 1. MEMBROS ------------------------------------------------
create table if not exists membros (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  papel      text not null default 'dev',   -- dev | doc | scrum | design
  frente_id  bigint references frentes(id) on delete set null,
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
  criador_id     uuid references membros(id) on delete set null,
  escopo         text not null default 'individual' check (escopo in ('frente', 'individual')),
  frente_id      bigint references frentes(id) on delete restrict,
                 -- obrigatório quando escopo = 'frente' (ver constraint abaixo); numa
                 -- individual é opcional — marca a frente/matéria a que a tarefa se
                 -- relaciona, mesmo sem envolver o time todo. A unidade de estudo da
                 -- tarefa não é mais coluna daqui: é frentes.unidade, alcançada por
                 -- este frente_id.
  status         text not null default 'pendente',   -- pendente | fazendo | revisao | concluida
  prioridade     text not null default 'media',      -- baixa | media | alta
  inicio         date,
  prazo          date,
  local_entrega  text,                               -- link onde a atividade foi/será entregue (GitHub, Drive, Forms...)
  issue_numero   integer,                            -- número da issue no repositório (só leitura via API do GitHub)
  observacoes    text,                               -- notas de quem entregou a atividade
  subiu_git      boolean not null default false,      -- a entrega já está versionada no repositório?
  revisor_id     uuid references membros(id) on delete set null,
                 -- opcional: quem vai revisar a entrega (ver 2d. REVISÕES). Sem
                 -- revisor, a tarefa conclui direto ao ser entregue — não é
                 -- validado aqui que revisor ≠ responsável porque responsável é
                 -- tarefa_responsaveis (N pessoas numa tarefa de frente), não dá
                 -- pra expressar isso num check nesta tabela; a policy de INSERT
                 -- em revisoes é quem barra de verdade.
  commit_confirmado_em timestamptz,
                 -- preenchido ao confirmar que o commit da última entrega subiu;
                 -- zerado de novo a cada reentrega que precisar de commit (ver
                 -- trigger em 2d. ENTREGAS).
  arquivada      boolean not null default false,      -- arquivada em vez de apagada: a trilha não pode sumir
  concluido_em   timestamptz,                         -- preenchido sozinho quando o status vira "concluida"
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint tarefa_de_frente_tem_frente check (escopo <> 'frente' or frente_id is not null)
);

create index if not exists idx_tarefas_prazo on tarefas(prazo);
create index if not exists idx_tarefas_frente on tarefas(frente_id);
create index if not exists idx_tarefas_revisor on tarefas(revisor_id);

-- ---------- 2a. RESPONSÁVEIS -------------------------------------------
-- Quem executa a tarefa. Uma linha por pessoa: tarefa individual tem uma
-- linha só, tarefa de frente tem uma por integrante da frente.
create table if not exists tarefa_responsaveis (
  tarefa_id  bigint not null references tarefas(id) on delete cascade,
  membro_id  uuid   not null references membros(id) on delete cascade,
  primary key (tarefa_id, membro_id)
);

create index if not exists idx_tarefa_responsaveis_membro on tarefa_responsaveis(membro_id);

-- Garante em nível de banco que individual tem no máximo 1 responsável e
-- frente tem pelo menos 1 — não importa por qual caminho a escrita veio.
create or replace function public.verificar_responsaveis()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tarefa_id bigint := coalesce(new.tarefa_id, old.tarefa_id);
  v_escopo    text;
  v_qtd       int;
begin
  select escopo into v_escopo from tarefas where id = v_tarefa_id;
  if v_escopo is null then
    return coalesce(new, old); -- tarefa já foi removida em cascata, nada a validar
  end if;

  select count(*) into v_qtd from tarefa_responsaveis where tarefa_id = v_tarefa_id;

  if v_escopo = 'individual' and v_qtd > 1 then
    raise exception 'Tarefa individual não pode ter mais de um responsável (tarefa %).', v_tarefa_id;
  end if;

  if v_escopo = 'frente' and v_qtd = 0 then
    raise exception 'Tarefa de frente não pode ficar sem responsável (tarefa %).', v_tarefa_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_verificar_responsaveis on tarefa_responsaveis;
create trigger trg_verificar_responsaveis
  after insert or update or delete on tarefa_responsaveis
  for each row execute function public.verificar_responsaveis();

-- Registra atribuição/reatribuição/desatribuição na trilha — substitui o
-- antigo bloco de "reatribuiu" que observava tarefas.responsavel_id.
create or replace function public.registrar_atribuicao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into historico (tarefa_id, autor_id, acao, campo, valor_novo)
    values (new.tarefa_id, auth.uid(), 'atribuiu', 'responsavel', new.membro_id::text);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.membro_id is distinct from old.membro_id then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.tarefa_id, auth.uid(), 'reatribuiu', 'responsavel', old.membro_id::text, new.membro_id::text);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo)
    values (old.tarefa_id, auth.uid(), 'desatribuiu', 'responsavel', old.membro_id::text);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_hist_atribuicao on tarefa_responsaveis;
create trigger trg_hist_atribuicao
  after insert or update or delete on tarefa_responsaveis
  for each row execute function public.registrar_atribuicao();

-- O Quadro escuta postgres_changes só na tabela tarefas (é nela que o
-- realtime do Supabase está ligado). Atribuir/reatribuir/desatribuir mexe
-- só em tarefa_responsaveis, então sem isso aqui ninguém veria a mudança
-- ao vivo — só ao recarregar a página.
create or replace function public.tocar_tarefa_responsaveis()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update tarefas set atualizado_em = now() where id = coalesce(new.tarefa_id, old.tarefa_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_tocar_tarefa_responsaveis on tarefa_responsaveis;
create trigger trg_tocar_tarefa_responsaveis
  after insert or update or delete on tarefa_responsaveis
  for each row execute function public.tocar_tarefa_responsaveis();

-- Tarefa de frente: ao criar (ou quando o escopo passa a ser "frente"),
-- atribui todo mundo que está na frente, de uma vez. Não é retroativo: quem
-- entra na frente depois não ganha as tarefas antigas dela — só valeria
-- pra atribuições futuras, e isso já acontece naturalmente porque este
-- trigger só roda no INSERT ou na mudança de escopo, nunca por tabela
-- membros mudar.
create or replace function public.atribuir_responsaveis_frente()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_qtd_membros      int;
  v_qtd_responsaveis int;
begin
  if new.escopo = 'frente' and (tg_op = 'INSERT' or old.escopo is distinct from 'frente') then
    if new.frente_id is null then
      raise exception 'Tarefa de frente precisa de uma frente.';
    end if;

    select count(*) into v_qtd_membros from membros where frente_id = new.frente_id;
    if v_qtd_membros = 0 then
      raise exception 'A frente % não tem nenhum integrante — não dá pra criar tarefa de frente sem responsável.', new.frente_id;
    end if;

    insert into tarefa_responsaveis (tarefa_id, membro_id)
    select new.id, m.id from membros m where m.frente_id = new.frente_id
    on conflict do nothing;
  end if;

  -- Virou individual: garante que não sobrou mais de um responsável (se
  -- sobrou, quem está mexendo precisa tirar os extras antes).
  if tg_op = 'UPDATE' and new.escopo is distinct from old.escopo and new.escopo = 'individual' then
    select count(*) into v_qtd_responsaveis from tarefa_responsaveis where tarefa_id = new.id;
    if v_qtd_responsaveis > 1 then
      raise exception 'Tarefa tem % responsáveis — tire os extras antes de virar individual.', v_qtd_responsaveis;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_atribuir_responsaveis_frente on tarefas;
create trigger trg_atribuir_responsaveis_frente
  after insert or update of escopo, frente_id on tarefas
  for each row execute function public.atribuir_responsaveis_frente();

-- ---------- 2d. ENTREGAS -------------------------------------------------
-- Histórico append-only de entregas. Uma tarefa pode ter várias linhas (cada
-- reentrega cria uma nova) — a mais recente é a que vale; nada é sobrescrito.
create table if not exists entregas (
  id              bigserial primary key,
  tarefa_id       bigint not null references tarefas(id) on delete cascade,
  autor_id        uuid not null references membros(id) on delete restrict,
  arquivo_drive   text not null,
  precisa_commit  boolean not null default false,
  commit_nome     text,
  o_que_mudou     text not null,
  criado_em       timestamptz not null default now(),
  constraint entregas_arquivo_drive_preenchido check (char_length(trim(arquivo_drive)) > 0),
  constraint entregas_o_que_mudou_minimo check (char_length(trim(o_que_mudou)) >= 10),
  constraint entregas_commit_nome_obrigatorio check (not precisa_commit or commit_nome is not null)
);

create index if not exists idx_entregas_tarefa on entregas(tarefa_id, criado_em desc);

-- Toda entrega nova invalida a confirmação de commit anterior — se a entrega
-- não precisar de commit o campo não importa, mas zera do mesmo jeito: uma
-- reentrega é sempre um novo estado, não uma continuação da anterior.
create or replace function public.reabrir_pendencia_de_commit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update tarefas set commit_confirmado_em = null where id = new.tarefa_id;
  return new;
end;
$$;

drop trigger if exists trg_reabrir_pendencia_commit on entregas;
create trigger trg_reabrir_pendencia_commit
  after insert on entregas
  for each row execute function public.reabrir_pendencia_de_commit();

-- Status não ganhou coluna nova: "pendente no git" é badge derivado (ver
-- view tarefas_estado_entrega em 2f), não trava a coluna do quadro. Ao
-- entregar, a tarefa já cai direto em "revisao" (se tiver revisor) ou
-- "concluida" (se não tiver) — precisar de commit só soma o badge por cima,
-- não segura a transição.
create or replace function public.aplicar_estado_pos_entrega()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tem_revisor boolean;
begin
  select revisor_id is not null into v_tem_revisor from tarefas where id = new.tarefa_id;
  update tarefas
  set status = case when v_tem_revisor then 'revisao' else 'concluida' end
  where id = new.tarefa_id;
  return new;
end;
$$;

drop trigger if exists trg_estado_pos_entrega on entregas;
create trigger trg_estado_pos_entrega
  after insert on entregas
  for each row execute function public.aplicar_estado_pos_entrega();

-- Entrega é evidência — registrada na trilha igual toda mudança em tarefas,
-- mesmo padrão de registrar_atribuicao() em 2a.
create or replace function public.registrar_entrega()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into historico (tarefa_id, autor_id, acao, campo, valor_novo)
  values (new.tarefa_id, auth.uid(), 'entregou', 'arquivo_drive', new.arquivo_drive);
  return new;
end;
$$;

drop trigger if exists trg_hist_entrega on entregas;
create trigger trg_hist_entrega
  after insert on entregas
  for each row execute function public.registrar_entrega();

-- ---------- 2e. REVISÕES ------------------------------------------------
-- Histórico append-only de revisões. entrega_id amarra a revisão à entrega
-- específica que foi revisada (não só à tarefa) — se a tarefa for reentregue
-- e revisada de novo, cada rodada fica rastreável.
create table if not exists revisoes (
  id           bigserial primary key,
  tarefa_id    bigint not null references tarefas(id) on delete cascade,
  entrega_id   bigint not null references entregas(id) on delete restrict,
  revisor_id   uuid not null references membros(id) on delete restrict,
  resultado    text not null check (resultado in ('concluido', 'observacao', 'falta_algo')),
  comentario   text,
  criado_em    timestamptz not null default now(),
  constraint revisoes_comentario_obrigatorio
    check (resultado = 'concluido' or char_length(trim(coalesce(comentario, ''))) > 0)
);

create index if not exists idx_revisoes_tarefa on revisoes(tarefa_id, criado_em desc);

-- Concluído ou Observações -> concluida; Falta algo -> fazendo (volta pro
-- calendário do responsável). revisor_id não muda — a mesma pessoa revisa
-- de novo se a tarefa voltar por "falta algo" e for reentregue.
create or replace function public.aplicar_resultado_revisao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update tarefas
  set status = case when new.resultado = 'falta_algo' then 'fazendo' else 'concluida' end
  where id = new.tarefa_id;
  return new;
end;
$$;

drop trigger if exists trg_estado_pos_revisao on revisoes;
create trigger trg_estado_pos_revisao
  after insert on revisoes
  for each row execute function public.aplicar_resultado_revisao();

-- Revisão é evidência — mesmo padrão de registrar_entrega() acima.
create or replace function public.registrar_revisao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into historico (tarefa_id, autor_id, acao, campo, valor_novo)
  values (new.tarefa_id, auth.uid(), 'revisou', 'resultado', new.resultado);
  return new;
end;
$$;

drop trigger if exists trg_hist_revisao on revisoes;
create trigger trg_hist_revisao
  after insert on revisoes
  for each row execute function public.registrar_revisao();

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
  acao         text not null,        -- criou | mudou_status | atribuiu | reatribuiu | desatribuiu | mudou_prazo | editou | mudou_git | arquivou | desarquivou | removeu | entregou | revisou | confirmou_commit
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
    -- Precisa vir antes do bloco de status: quem edita a data de início na
    -- mão manda um valor diferente aqui; quem só muda o status pra
    -- "fazendo" não manda nada, e é o bloco de status logo abaixo que
    -- preenche sozinho (se ainda estiver vazio). Checar aqui em cima evita
    -- registrar duas entradas ("mudou_status" e "editou inicio") pra uma
    -- única ação de quem só arrastou o card pra "Fazendo".
    if new.inicio is distinct from old.inicio then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'inicio', old.inicio::text, new.inicio::text);
    end if;

    if new.status is distinct from old.status then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'mudou_status', 'status', old.status, new.status);
      new.concluido_em := case when new.status = 'concluida' then now() else null end;
      if new.status = 'fazendo' and old.inicio is null then
        new.inicio := (now() at time zone 'America/Sao_Paulo')::date;
      end if;
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

    if new.frente_id is distinct from old.frente_id then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'frente_id', old.frente_id::text, new.frente_id::text);
    end if;

    if new.issue_numero is distinct from old.issue_numero then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'issue_numero', old.issue_numero::text, new.issue_numero::text);
    end if;

    if new.revisor_id is distinct from old.revisor_id then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_antigo, valor_novo)
      values (new.id, auth.uid(), 'editou', 'revisor_id', old.revisor_id::text, new.revisor_id::text);
    end if;

    -- Só registra o momento em que confirmou (null -> preenchido). O reset
    -- pra null a cada reentrega (trg_reabrir_pendencia_commit) é
    -- bookkeeping automático, não uma ação de alguém — não polui a trilha.
    if new.commit_confirmado_em is not null and old.commit_confirmado_em is null then
      insert into historico (tarefa_id, autor_id, acao, campo, valor_novo)
      values (new.id, auth.uid(), 'confirmou_commit', 'commit_confirmado_em', new.commit_confirmado_em::text);
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
alter table frentes              enable row level security;
alter table membros              enable row level security;
alter table tarefas              enable row level security;
alter table tarefa_responsaveis  enable row level security;
alter table historico            enable row level security;
alter table anexos               enable row level security;
alter table entregas             enable row level security;
alter table revisoes             enable row level security;

create policy "equipe le frentes"   on frentes for select to authenticated using (true);
create policy "equipe cria frentes" on frentes for insert to authenticated with check (true);
create policy "equipe edita frentes"on frentes for update to authenticated using (true);
create policy "equipe apaga frentes"on frentes for delete to authenticated using (true);

create policy "equipe le membros"   on membros   for select to authenticated using (true);
create policy "membro edita a si"   on membros   for update to authenticated using (auth.uid() = id);

create policy "equipe le tarefas"   on tarefas   for select to authenticated using (true);
create policy "equipe cria tarefas" on tarefas   for insert to authenticated with check (true);
create policy "equipe edita tarefas"on tarefas   for update to authenticated using (true);
-- Sem policy de DELETE: a equipe arquiva (arquivada = true), nunca apaga.
-- É o que mantém a trilha de histórico íntegra.

create policy "equipe le responsaveis"   on tarefa_responsaveis for select to authenticated using (true);
create policy "equipe atribui"           on tarefa_responsaveis for insert to authenticated with check (true);
create policy "equipe reatribui"         on tarefa_responsaveis for update to authenticated using (true);
create policy "equipe desatribui"        on tarefa_responsaveis for delete to authenticated using (true);

create policy "equipe le historico" on historico for select to authenticated using (true);
-- Repare: não existe policy de UPDATE nem DELETE em historico. É proposital.

create policy "equipe le entregas" on entregas for select to authenticated using (true);
create policy "responsavel entrega" on entregas for insert to authenticated with check (
  exists (
    select 1 from tarefa_responsaveis tr
    where tr.tarefa_id = entregas.tarefa_id and tr.membro_id = auth.uid()
  )
);
-- Sem policy de UPDATE/DELETE: entrega é histórico, reentrega é linha nova.

create policy "equipe le revisoes" on revisoes for select to authenticated using (true);
create policy "revisor designado revisa" on revisoes for insert to authenticated with check (
  revisor_id = auth.uid()
  and exists (
    select 1 from tarefas t where t.id = revisoes.tarefa_id and t.revisor_id = auth.uid()
  )
  and not exists (
    -- Ninguém revisa a própria tarefa — mesmo que tenha virado responsável
    -- depois de designado revisor (ex.: entrou na frente), a policy barra
    -- na hora de revisar, que é quando isso realmente importa.
    select 1 from tarefa_responsaveis tr
    where tr.tarefa_id = revisoes.tarefa_id and tr.membro_id = auth.uid()
  )
);
-- Sem policy de UPDATE/DELETE: revisão é histórico, nova rodada é linha nova.

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
-- "create or replace" não funciona aqui pra quem já tinha a view antiga
-- (com a coluna "unidade", derivada de tarefas.unidade): Postgres recusa
-- remover coluna da lista de saída de uma view via "or replace", só
-- aceita adicionar no fim ou trocar o cálculo de coluna já existente. Por
-- isso é "drop + create" — vale tanto pra quem está criando do zero
-- quanto pra quem está re-rodando o arquivo inteiro num banco antigo (a
-- migração no fim do arquivo também faz esse drop+create, pro caso de
-- alguém colar só aquele bloco isolado, sem rodar o arquivo inteiro).
drop view if exists relatorio_atividades;
-- security_invoker = on: sem isso, a view roda com o dono dela (quem a
-- criou), ignorando o RLS de historico/tarefas/membros/frentes — qualquer
-- authenticated que soubesse o nome dela furava as policies dessas
-- tabelas. Com invoker on, a view roda com a permissão de quem está
-- consultando, então volta a respeitar o RLS das tabelas de base.
create view relatorio_atividades
with (security_invoker = on)
as
select
  h.em,
  m.nome    as autor,
  m.papel,
  h.acao,
  h.campo,
  h.valor_antigo,
  h.valor_novo,
  t.titulo  as tarefa,
  t.status  as status_atual,
  t.escopo  as escopo,
  f.nome    as frente,
  f.unidade as frente_unidade
from historico h
left join membros m on m.id = h.autor_id
left join tarefas t on t.id = h.tarefa_id
left join frentes f on f.id = t.frente_id
order by h.em desc;

-- ---------- 6b. VIEW: estado derivado de entrega/revisão --------------
-- Única fonte de verdade pro estado calculado (pendente_git etc.) — quem
-- precisar mostrar isso (cartão, detalhe, calendário, /revisoes) lê daqui
-- em vez de recalcular cada um do seu jeito. security_invoker: mesma razão
-- de relatorio_atividades (ver 6) — sem isso a view ignora o RLS das
-- tabelas de base.
create or replace view tarefas_estado_entrega
with (security_invoker = on)
as
select
  t.id as tarefa_id,
  t.revisor_id,
  mr.nome as revisor_nome,
  t.commit_confirmado_em,
  ue.id as ultima_entrega_id,
  ue.autor_id as entrega_autor_id,
  ma.nome as entrega_autor_nome,
  ue.arquivo_drive,
  ue.precisa_commit,
  ue.commit_nome,
  ue.o_que_mudou,
  ue.criado_em as entregue_em,
  (ue.precisa_commit and t.commit_confirmado_em is null) as pendente_git,
  ur.id as ultima_revisao_id,
  ur.resultado as ultimo_resultado,
  ur.comentario as ultimo_comentario,
  ur.criado_em as revisado_em,
  mv.nome as ultimo_revisor_nome
from tarefas t
left join membros mr on mr.id = t.revisor_id
left join lateral (
  select * from entregas e where e.tarefa_id = t.id order by e.criado_em desc limit 1
) ue on true
left join membros ma on ma.id = ue.autor_id
left join lateral (
  select * from revisoes r where r.tarefa_id = t.id order by r.criado_em desc limit 1
) ur on true
left join membros mv on mv.id = ur.revisor_id;

-- =====================================================================
-- MIGRAÇÃO · arquivar em vez de apagar + coluna de unidade (rode só se já
-- executou este arquivo antes de agosto/2026). Se está criando o projeto
-- do zero, ignore este bloco — as seções acima já vêm com tudo certo.
--
-- A função registrar_historico() já foi redefinida na seção 4 acima com
-- "create or replace" — rodar o arquivo inteiro já atualiza quem tinha a
-- versão antiga. Não precisa copiar o corpo da função de novo aqui.
-- =====================================================================

-- 1. Novas colunas, sem quebrar quem já tem tarefas cadastradas.
alter table tarefas add column if not exists arquivada boolean not null default false;
alter table tarefas add column if not exists issue_numero integer;

-- 2. Tira a permissão de apagar tarefa. Dali pra frente só dá pra arquivar.
drop policy if exists "equipe apaga tarefas" on tarefas;

-- =====================================================================
-- MIGRAÇÃO · tarefa de frente vs. individual (rode só se o banco ainda
-- tem a coluna tarefas.responsavel_id — ou seja, rodou este arquivo antes
-- desta mudança). Se está criando o projeto do zero, ignore este bloco.
--
-- Ordem importa:
--   1. cria a estrutura nova (frentes, tarefa_responsaveis, colunas)
--   2. migra os dados de responsavel_id pra tarefa_responsaveis
--   3. os triggers (verificar_responsaveis, registrar_atribuicao,
--      atribuir_responsaveis_frente) já foram criados mais acima no
--      arquivo — rodar o arquivo inteiro já deixa isso pronto antes de
--      chegar aqui, não precisa repetir
--   4. só então apaga responsavel_id, depois que os dados já estão a
--      salvo em tarefa_responsaveis
-- =====================================================================

-- 1. Estrutura nova.
create table if not exists frentes (
  id         bigserial primary key,
  nome       text not null,
  criado_em  timestamptz not null default now()
);

-- unidade/cor/ordem vieram depois — se a frentes acima já existia sem elas
-- (banco já no ar), essas três linhas completam sem mexer no que já tem.
alter table frentes add column if not exists unidade text;
alter table frentes add column if not exists cor     text not null default 'ferro';
alter table frentes add column if not exists ordem   int  not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'frentes_cor_check') then
    alter table frentes add constraint frentes_cor_check check (cor in ('musgo', 'trigo', 'broto', 'ferro'));
  end if;
end $$;

alter table membros add column if not exists frente_id bigint references frentes(id) on delete set null;

alter table tarefas add column if not exists escopo text not null default 'individual';
alter table tarefas add column if not exists frente_id bigint references frentes(id) on delete restrict;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tarefas_escopo_check') then
    alter table tarefas add constraint tarefas_escopo_check check (escopo in ('frente', 'individual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tarefa_de_frente_tem_frente') then
    alter table tarefas add constraint tarefa_de_frente_tem_frente
      check (escopo <> 'frente' or frente_id is not null);
  end if;
end $$;

create table if not exists tarefa_responsaveis (
  tarefa_id  bigint not null references tarefas(id) on delete cascade,
  membro_id  uuid   not null references membros(id) on delete cascade,
  primary key (tarefa_id, membro_id)
);

create index if not exists idx_tarefa_responsaveis_membro on tarefa_responsaveis(membro_id);
create index if not exists idx_tarefas_frente on tarefas(frente_id);

-- 2. Migra quem já tinha responsavel_id preenchido. Só faz sentido se a
--    coluna antiga ainda existir (senão essa migração já rodou antes).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'tarefas' and column_name = 'responsavel_id'
  ) then
    insert into tarefa_responsaveis (tarefa_id, membro_id)
    select id, responsavel_id from tarefas where responsavel_id is not null
    on conflict do nothing;
  end if;
end $$;

-- 3. RLS das tabelas novas, pra quem já tinha o banco rodando sem elas
--    (quem está criando do zero já ganhou isso na seção 5 acima).
alter table frentes             enable row level security;
alter table tarefa_responsaveis enable row level security;

drop policy if exists "equipe le frentes"    on frentes;
drop policy if exists "equipe cria frentes"  on frentes;
drop policy if exists "equipe edita frentes" on frentes;
drop policy if exists "equipe apaga frentes" on frentes;
create policy "equipe le frentes"   on frentes for select to authenticated using (true);
create policy "equipe cria frentes" on frentes for insert to authenticated with check (true);
create policy "equipe edita frentes"on frentes for update to authenticated using (true);
create policy "equipe apaga frentes"on frentes for delete to authenticated using (true);

drop policy if exists "equipe le responsaveis" on tarefa_responsaveis;
drop policy if exists "equipe atribui"         on tarefa_responsaveis;
drop policy if exists "equipe reatribui"       on tarefa_responsaveis;
drop policy if exists "equipe desatribui"      on tarefa_responsaveis;
create policy "equipe le responsaveis" on tarefa_responsaveis for select to authenticated using (true);
create policy "equipe atribui"         on tarefa_responsaveis for insert to authenticated with check (true);
create policy "equipe reatribui"       on tarefa_responsaveis for update to authenticated using (true);
create policy "equipe desatribui"      on tarefa_responsaveis for delete to authenticated using (true);

-- 4. Só agora, com os dados replicados e os triggers no ar, tira a coluna
--    antiga (e o índice que só fazia sentido com ela).
alter table tarefas drop column if exists responsavel_id;
drop index if exists idx_tarefas_responsavel;

-- =====================================================================
-- MIGRAÇÃO · unidade sai de tarefas, mora só em frentes (rode só se o
-- banco ainda tem a coluna tarefas.unidade — ou seja, rodou este arquivo
-- antes desta mudança). Se está criando o projeto do zero, ignore: a
-- tabela tarefas na seção 2 já vem sem essa coluna.
--
-- A unidade de estudo não desaparece do produto, só de tarefas: passa a
-- viver em frentes.unidade e a tarefa a alcança por frente_id.
--
-- A view relatorio_atividades (seção 6) referenciava t.unidade. Postgres
-- não deixa "create or replace view" remover uma coluna da lista de saída
-- — só trocar o cálculo de colunas que já existem ou acrescentar no fim —
-- então rodar de novo a seção 6 sozinha NÃO atualiza a view antiga o
-- suficiente pra soltar a dependência, e o "alter table drop column" logo
-- abaixo falha com "cannot drop column unidade because other objects
-- depend on it" (2BP01). Por isso este bloco derruba e recria a view na
-- versão nova *antes* de mexer na coluna, sem depender de ter rodado a
-- seção 6 primeiro — pode colar só este bloco isolado num banco já no ar.
-- =====================================================================
drop view if exists relatorio_atividades;
-- security_invoker = on: sem isso, a view roda com o dono dela (quem a
-- criou), ignorando o RLS de historico/tarefas/membros/frentes — qualquer
-- authenticated que soubesse o nome dela furava as policies dessas
-- tabelas. Com invoker on, a view roda com a permissão de quem está
-- consultando, então volta a respeitar o RLS das tabelas de base.
create view relatorio_atividades
with (security_invoker = on)
as
select
  h.em,
  m.nome    as autor,
  m.papel,
  h.acao,
  h.campo,
  h.valor_antigo,
  h.valor_novo,
  t.titulo  as tarefa,
  t.status  as status_atual,
  t.escopo  as escopo,
  f.nome    as frente,
  f.unidade as frente_unidade
from historico h
left join membros m on m.id = h.autor_id
left join tarefas t on t.id = h.tarefa_id
left join frentes f on f.id = t.frente_id
order by h.em desc;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'tarefas' and column_name = 'unidade'
  ) then
    -- De-para: cada tarefa herda a frente cuja unidade bate com o valor
    -- que estava em tarefas.unidade. Não mexe em quem já tem frente_id
    -- (tarefa de frente já chegou aqui com o valor certo). Quando mais de
    -- uma frente compartilha a mesma unidade, fica com a de menor "ordem"
    -- (empate: menor id) — escolha determinística, não aleatória.
    update tarefas t
    set frente_id = f.id
    from (
      select distinct on (unidade) id, unidade
      from frentes
      where unidade is not null
      order by unidade, ordem, id
    ) f
    where t.frente_id is null
      and t.unidade = f.unidade;

    alter table tarefas drop column unidade;
  end if;
end $$;
