# Navegação do Caderno de Campo

Documento de apoio pra montar o tutorial de uso do painel. Descreve o estado
atual do site: todas as rotas, o fluxo completo de uma tarefa, a tabela de
status, quem pode fazer o quê, e onde o professor encontra cada evidência.

Regra geral de visibilidade, válida pra tudo neste documento: **qualquer
integrante autenticado vê todos os dados de todo mundo** — tarefas, entregas,
revisões e o histórico completo. Não existe visão privada. É proposital: o
painel existe pra gerar evidência compartilhada pro professor, então esconder
dado de um integrante do outro iria contra o propósito do projeto. O que
muda de pessoa pra pessoa não é o que se vê, é o que se pode **fazer** —
seção 4 detalha isso.

## 1. Rotas

| Rota | O que mostra |
|---|---|
| `/login` | Entrada e cadastro. Única página acessível sem sessão — qualquer outra rota redireciona pra cá se não houver login. |
| `/` (Semana) | Painel rápido: tarefas atrasadas, dos próximos 7 dias e mais adiante. Botão "minhas tarefas" filtra a visão (é só um filtro de tela, não uma restrição de dado). |
| `/tarefas` (Quadro) | Kanban com as 4 colunas de status. Duas visões — "Individuais" e "Da frente" — alternáveis. Busca por título, filtros por responsável/prioridade/frente, atalho de teclado "n" pra nova tarefa, arrastar-e-soltar entre colunas, atualização em tempo real (várias pessoas vendo ao mesmo tempo). |
| `/atribuicoes` | Tabela editável campo a campo: responsável, dia, local de entrega, GitHub, frente, prioridade, status. "Nova atribuição" abre o mesmo formulário completo do Quadro. Tempo real. |
| `/calendario` | Grade mensal por prazo. Filtro por responsável (calendário pessoal vs. geral). Cada dia mostra até 3 tarefas; clicar numa abre o painel de detalhe. Sinaliza atraso, prioridade e devolução de revisor pendente (ver seção 3). |
| `/equipe` | Lista de integrantes — papel e frente de cada um. Cada pessoa só edita o próprio papel/frente, não o dos colegas. |
| `/equipe/[id]` | Painel de um integrante: trabalho individual e trabalho de frente, mostrados separados, com tempo médio de conclusão e distribuição por unidade de estudo. |
| `/frentes` | Lista das frentes (sub-times), ordenada, com integrantes e unidade de estudo de cada uma. Formulário de criar frente nova. |
| `/frentes/[id]` | Painel de uma frente: tarefas conjuntas da frente + trabalho individual de cada integrante dela, edição dos dados da frente (nome, unidade, cor, ordem). |
| `/entregas` ("Relatório final") | Lista enxuta: tarefa, quem fez, quando, se subiu no Git. Clicar numa linha abre observações, anexos e a Nota do revisor daquela tarefa, se houver. |
| `/revisoes` | Fila de revisão (só existe depois do Bloco D deste projeto). Duas seções: "Para revisar" (ação do revisor designado) e "Minhas tarefas em revisão" (leitura, pra quem está esperando ser revisado). |
| `/codigo` | Espelho do GitHub — commits, Pull Requests, status do CI. Somente leitura de propósito: o painel nunca cria commit, pra não misturar a autoria de todo mundo numa conta só. |
| `/relatorio` (Trilha) | Linha do tempo cronológica de tudo que aconteceu (histórico bruto), resumo por pessoa, exportação em CSV/PDF. É a página-prova principal do projeto. |
| `/reunioes` | Atas das reuniões da equipe — data, pauta, presentes, decisões. |
| `/sprint` | Sprint Report: mesmas métricas da Trilha, recortadas por um intervalo de datas escolhido, também exportável. |

## 2. Fluxo completo de uma tarefa

Do nascimento até a conclusão, na ordem em que se clica:

1. **Criar.** Botão "Nova tarefa" (atalho de teclado "n", em qualquer tela) ou
   "Nova atribuição" em `/atribuicoes` — os dois abrem o mesmo formulário.
2. Preenche título e descrição, escolhe o **escopo**:
   - *Individual* — escolhe um responsável (opcional) e, se quiser, uma
     frente (opcional — vira só o tema/matéria da tarefa, não muda quem é
     responsável).
   - *Da frente* — escolhe a frente (obrigatório); o banco atribui **todo
     mundo daquela frente** como responsável, automaticamente.
3. Escolhe um **revisor** (opcional). A lista já exclui quem vai ser
   responsável — ninguém revisa a própria tarefa. Sem revisor, um aviso no
   próprio formulário avisa: a tarefa vai concluir direto quando for entregue.
4. Prioridade, data de início (opcional), prazo (opcional), local de entrega
   (opcional), número da issue no GitHub (opcional), um anexo (opcional).
5. Salva. A tarefa nasce com status **A fazer**, some registrado no
   histórico automaticamente ("criou") e aparece no Quadro, no Calendário
   (se tem prazo) e na Semana.
6. Responsável (ou qualquer integrante) clica no cartão da tarefa — no
   Quadro, na Semana, no painel da frente ou no Calendário — pra abrir o
   **painel de detalhe**. Dá pra editar qualquer campo ali, inclusive mudar o
   status na mão (ex.: mover pra **Fazendo** — o início é preenchido
   sozinho na primeira vez que isso acontece, se ainda estiver vazio).
7. Quando o trabalho está pronto, o responsável clica em **Entregar**
   (dentro do painel de detalhe) — só aparece pra quem é responsável daquela
   tarefa.
8. Preenche o modal de entrega: nome do arquivo no Drive (obrigatório),
   se precisa de commit no Git (Sim/Não), nome do commit (só se Sim), o que
   mudou (mínimo 10 caracteres). Confirma.
9. O banco decide sozinho o que acontece com o status:
   - Tem revisor → vira **Em revisão**.
   - Não tem revisor → vira **Concluída** direto.
   - "Precisa de commit" marcado como Sim → aparece o badge âmbar
     **Pendente no Git** no painel de detalhe, mesmo que o status já esteja
     "Em revisão" por baixo.
10. Se precisava de commit: o responsável sobe o código de verdade no
    GitHub, volta no painel de detalhe e clica **Confirmar commit** — o
    badge some.
11. Se tinha revisor: a tarefa aparece pra ele em `/revisoes`, seção
    "Para revisar" — só depois do commit confirmado (se precisava; senão,
    aparece na hora). Enquanto isso, o responsável vê a mesma tarefa em
    "Minhas tarefas em revisão" (só leitura).
12. O revisor lê o que mudou e escolhe uma das três ações:
    - **Concluído** — tarefa vira Concluída na hora, sem comentário.
    - **Observações** — escreve um comentário (obrigatório) — tarefa vira
      Concluída, e o comentário aparece como **Nota do revisor** no painel
      de detalhe e em `/entregas`.
    - **Falta algo** — escreve o que falta (obrigatório) — tarefa volta pra
      **Fazendo**, reaparece no Calendário do responsável com o marcador
      "falta:" no chip, e o painel de detalhe mostra o bloco vermelho
      **Falta isso:** com o nome do revisor, a data e o comentário.
13. Se foi devolvida: o responsável ajusta e repete os passos 7 a 12 —
    reentrega. É uma linha nova em cada tabela (entrega e revisão), o
    histórico anterior nunca é apagado nem sobrescrito. O revisor continua
    sendo o mesmo. O bloco "Falta isso:" some assim que a reentrega
    acontece (ele só é visível "até a próxima entrega").
14. Concluída — por revisor ou direto —, a tarefa some das filas de
    pendência mas continua visível em `/entregas`, na Trilha (`/relatorio`)
    e no Sprint Report (`/sprint`), pra sempre.
15. Em qualquer momento, dá pra **arquivar** a tarefa (ela some dos quadros
    ativos, mas o histórico continua existindo — tarefa nunca é apagada de
    verdade).

## 3. Status

| Status | Cor do badge | Significado | O que fazer |
|---|---|---|---|
| **A fazer** | cinza | Criada, ninguém começou ainda | Responsável começa o trabalho ou já muda pra "Fazendo" |
| **Fazendo** | âmbar | Em andamento — ou devolvida por um revisor ("Falta algo") e esperando ajuste | Responsável termina e clica em Entregar |
| **Em revisão** | azul-acinzentado | Já entregue; esperando confirmar commit ou esperando o revisor avaliar | Se tem o badge "Pendente no Git": responsável confirma o commit. Senão: revisor avalia em `/revisoes` |
| **Concluída** | verde | Terminada — direto (sem revisor) ou aprovada pelo revisor | Nada a fazer — evidência já está registrada |

Dois avisos **não são status novos** — são sinais que aparecem por cima do
status, calculados a partir de `entregas`/`revisoes`, nunca guardados numa
coluna própria:

- **Pendente no Git** (badge âmbar, no painel de detalhe) — a última entrega
  marcou "precisa de commit" e ninguém confirmou ainda. Enquanto isso, a
  tarefa não entra na fila de revisão de ninguém, mesmo já estando com
  status "Em revisão" por baixo.
- **falta: / Falta isso:** (marcador no Calendário / bloco vermelho no
  detalhe) — o último resultado de revisão foi "Falta algo" e ainda não
  houve reentrega desde então. Some sozinho assim que a tarefa for
  reentregue.

## 4. Quem pode fazer o quê

| Ação | Responsável da tarefa | Revisor designado dela | Qualquer outro integrante |
|---|---|---|---|
| Ver qualquer tarefa, entrega, revisão ou linha do histórico | sim | sim | sim — tudo é evidência compartilhada |
| Criar tarefa nova | sim | sim | sim |
| Editar campos da tarefa (título, prazo, prioridade, frente, **quem é o revisor**, etc.) | sim | sim | sim — não é restrito ao responsável |
| Clicar em **Entregar** / registrar uma entrega | **sim** | não, a menos que também seja responsável | não |
| Clicar em **Confirmar commit** | **sim** (mesma regra da entrega) | — | — |
| Revisar (Concluído / Observações / Falta algo) | não — barrado mesmo tentando direto pela API, a regra é do banco (RLS), não só da tela | **sim, só quem está em `revisor_id` daquela tarefa** | não |
| Arquivar tarefa | sim | sim | sim |
| Apagar uma tarefa de verdade | não | não | não — ninguém, não existe essa opção em lugar nenhum |
| Editar ou apagar uma entrega/revisão já registrada | não | não | não — ninguém, nem quem criou; entrega e revisão são histórico que não se reescreve |

O ponto que costuma surpreender: **editar os campos de uma tarefa é liberado
pra qualquer integrante logado**, não só pro responsável — é assim desde
antes deste recurso de entrega/revisão, pra equipe pequena poder ajustar
prazo/prioridade uma da outra sem fricção. As duas exceções gravadas em regra
de banco (não só na tela) são **entregar** (só quem está atribuído à tarefa)
e **revisar** (só a pessoa exata escolhida como revisor, e nunca a própria
pessoa que é responsável por ela).

## 5. Onde o professor encontra a evidência

- **Linha do tempo cronológica de tudo** (criou, mudou status, atribuiu,
  entregou, revisou, arquivou — com autor e data/hora de cada ação): tabela
  `historico`, visível em `/relatorio` (Trilha). Nunca pode ser editada nem
  apagada por ninguém, nem pela equipe — é a prova que não se manipula.
- **Quem entregou o quê, quando, com qual arquivo/commit**: tabela
  `entregas`, visível ao abrir qualquer tarefa (painel de detalhe) ou em
  `/entregas`. Cada reentrega é uma linha nova — nada é sobrescrito.
- **Quem revisou, o resultado e o comentário**: tabela `revisoes`, visível
  no bloco "Nota do revisor" / "Falta isso:" de cada tarefa, e no
  "Histórico de revisões" quando há mais de uma rodada.
- **Divisão de trabalho por pessoa**: `/relatorio` (resumo por pessoa) e
  `/sprint` (mesmo resumo, recortado por período) — os dois exportam em CSV
  e PDF.
- **Evidência de commit de verdade** (fora do painel, no GitHub): `/codigo`
  mostra os commits reais por autor; cruza com o nome de commit informado
  na entrega pra conferir que bate.
- **Cobertura das unidades curriculares**: cada frente tem uma `unidade`
  (POO, Modelagem, Lógica, BI, Autoconhecimento) em `/frentes`; o resumo por
  pessoa na Trilha e no Sprint Report mostra quais unidades cada um
  trabalhou.
