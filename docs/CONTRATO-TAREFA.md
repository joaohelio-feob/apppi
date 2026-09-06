# Contrato de tarefa

Documento único que define **quais atributos uma tarefa precisa ter, quais
valores são aceitos e o que o banco preenche sozinho**.

É a fonte de verdade para três consumidores:

1. a skill que **gera** tarefas;
2. o script `scripts/publicar-tarefas.mjs`, que as **publica** pelo Cursor;
3. a página `/publicar`, que as recebe coladas e insere depois de confirmação.

Cada afirmação aqui aponta para o arquivo e a linha que a sustenta. Se o
código mudar e este documento não, o código ganha — e o documento está
errado, não o contrário.

---

## Vocabulário: o objeto é uma tarefa, não uma linha de tabela

O objeto de handoff representa **uma tarefa no sentido do domínio**. Ele
**não** é um espelho 1:1 da tabela `tarefas`, e não dá para ser: o campo que
decide quem faz o trabalho não é coluna de `tarefas`, é linha em
`tarefa_responsaveis` ([schema.sql:93-101](../supabase/schema.sql#L93-L101)).
Um objeto que só tivesse colunas de `tarefas` não conseguiria dizer de quem é
a tarefa.

Por isso o objeto carrega `responsavel` como chave própria, e quem publica
sabe que ela vira **um segundo INSERT**, noutra tabela.

Pela mesma razão o objeto carrega **nomes, não IDs**: ele é escrito e lido por
gente, colado à mão e gerado fora do banco. `frente_id: 7` num texto colado é
ilegível e envelhece no dia em que alguém recriar a frente. Quem traduz nome →
`bigint`/`uuid` é a página ou o script, contra `frentes` e `membros`, usando
`resolverPorNome` de [lib/nomes.mjs](../lib/nomes.mjs).

---

## A. Campos que quem cria a tarefa preenche

| Chave no objeto | Coluna | Tipo | Obrigatório | Valores aceitos / formato |
|---|---|---|---|---|
| `titulo` | `tarefas.titulo` | `text not null` ([:52](../supabase/schema.sql#L52)) | **sim** | Texto não vazio depois de `trim()`. Sem rótulo embutido (ver A.1). |
| `descricao` | `tarefas.descricao` | `text` ([:53](../supabase/schema.sql#L53)) | não | Texto livre. Linhas `- [ ]` viram critérios de aceite (ver A.2). |
| `escopo` | `tarefas.escopo` | `text not null` ([:55](../supabase/schema.sql#L55)) | **sim** | `"individual"` ou `"frente"`. Único campo desta tabela com `check` de verdade no banco. |
| `frente` | → `tarefas.frente_id` | nome, resolvido | **condicional** | Nome de uma frente existente. **Obrigatório** quando `escopo` é `"frente"` (constraint `tarefa_de_frente_tem_frente`, [:85](../supabase/schema.sql#L85)); opcional em `"individual"`, onde marca a matéria. |
| `responsavel` | → `tarefa_responsaveis` | nome, resolvido | não | Nome de um membro. **Proibido** quando `escopo` é `"frente"` (ver A.4). No máximo um. |
| `revisor` | → `tarefas.revisor_id` | nome, resolvido | não | Nome de um membro. Não pode ser o mesmo do `responsavel` (ver A.5). |
| `prioridade` | `tarefas.prioridade` | `text not null` ([:63](../supabase/schema.sql#L63)) | não | `"baixa"`, `"media"` ou `"alta"`. Omitido, o banco usa `'media'`. **Sem check no banco** (ver A.3). |
| `prazo` | `tarefas.prazo` | `date` ([:65](../supabase/schema.sql#L65)) | não | `"AAAA-MM-DD"`. |
| `local_entrega` | `tarefas.local_entrega` | `text` ([:66](../supabase/schema.sql#L66)) | não | URL `http`/`https` para virar link; qualquer outra coisa vira anotação (ver A.6). |
| `issue_numero` | `tarefas.issue_numero` | `integer` ([:67](../supabase/schema.sql#L67)) | não | Inteiro ≥ 1 (ver A.7). |
| `observacoes` | `tarefas.observacoes` | `text` ([:68](../supabase/schema.sql#L68)) | não | Texto livre. **Não** é lugar de revisor (A.5) nem de esforço/dependência (seção C). |

Qualquer chave fora desta tabela é **erro de validação**, não algo a ignorar
em silêncio. Chave desconhecida quase sempre significa que quem escreveu
inventou um campo que o painel não tem.

### A.1 Rótulo é chave, nunca texto dentro do valor

O valor de `titulo` e de `descricao` é **só o conteúdo**. A palavra
`"Descrição:"` **não faz parte do valor** — ela é o nome da chave.

```json
{ "titulo": "Implementar conversão de base", "descricao": "Converter entre bases 2, 8, 10 e 16." }
```

```json
{ "titulo": "Título: Implementar conversão de base", "descricao": "Descrição: Converter entre bases." }
```

O segundo está **errado**. As tarefas hoje no painel estão sujas exatamente
assim: o prefixo entrou no valor e agora aparece em toda tela que mostra a
descrição. Nenhum caminho de escrita do app injeta esse prefixo — verificado:
`grep -rn "Descrição:" app components lib` não retorna nada, e os dois únicos
caminhos que gravam a coluna
([FormularioTarefa.tsx:82](../components/FormularioTarefa.tsx#L82) e
[DetalheTarefa.tsx:200](../components/DetalheTarefa.tsx#L200)) gravam o campo
cru. Foi digitado.

### A.2 Critérios de aceite dentro de `descricao`

Convenção **opcional**, não schema. Uma linha que comece com `- [ ] ` (ou
`*`/`+`) vira item marcável no painel de detalhes e alimenta o progresso no
cartão. O parser é [lib/criterios.ts](../lib/criterios.ts), regex em
[:39](../lib/criterios.ts#L39).

```json
{
  "descricao": "Converter entre bases 2, 8, 10 e 16.\n\n- [ ] Função de conversão\n- [ ] Testes com valores de borda\n- [x] Assinatura definida"
}
```

Regras:

- descrição **sem nenhuma checkbox** continua texto puro — nem checklist nem
  barra de progresso aparecem, e o layout não abre buraco;
- marcar um item preserva o resto do markdown **byte a byte**;
- `- []` (sem o espaço) **não** é critério, é texto comum;
- ler sempre por `lerCriterios` / `progressoCriterios` / `alternarCriterio`,
  nunca repetindo a regex.

### A.3 `status` e `prioridade` não têm check no banco

`escopo` tem `check` ([:55](../supabase/schema.sql#L55)). **`status` e
`prioridade` não têm** — são `text not null` com `default`, e os valores
válidos vivem só na aplicação
([types.ts:1-2](../lib/types.ts#L1-L2)):

| Campo | Valores que a aplicação entende |
|---|---|
| `status` | `pendente` · `fazendo` · `revisao` · `concluida` |
| `prioridade` | `baixa` · `media` · `alta` |

**O banco aceitaria lixo.** `insert ... prioridade: 'urgentíssimo'` passa, e a
tarefa some de todo filtro de prioridade sem erro nenhum. A validação é
inteiramente de quem escreve — daí este contrato.

**`status` não é campo de entrada.** Ver B.2.

### A.4 `responsavel` e o escopo

- **`escopo: "individual"`** — no máximo **um** responsável. O banco recusa o
  segundo: `verificar_responsaveis`
  ([:105](../supabase/schema.sql#L105), trigger em
  [:135](../supabase/schema.sql#L135)) levanta exceção quando uma tarefa
  individual passa de um.
- **`escopo: "frente"`** — a chave `responsavel` **não é enviada**. O trigger
  `atribuir_responsaveis_frente`
  ([:240](../supabase/schema.sql#L240)) atribui **todos os integrantes da
  frente** dentro da mesma transação do INSERT.

Enviar `responsavel` junto com `escopo: "frente"` é **erro de validação**, não
algo a ignorar em silêncio: quem escreveu isso acredita estar escolhendo uma
pessoa, e o resultado real seria a frente inteira atribuída. Recusar é a única
forma de a pessoa descobrir que entendeu errado.

Uma tarefa de frente cuja frente **não tem nenhum integrante** é recusada pelo
próprio trigger, com exceção.

### A.5 `revisor` é coluna, e a validação é nossa

Revisor é `tarefas.revisor_id` ([:70](../supabase/schema.sql#L70)), coluna com
FK para `membros`. **Nunca vai em `observacoes`** — texto livre não é schema,
não filtra, não agrega e cria uma segunda fonte de verdade para o mesmo dado.

**Revisor não pode ser o responsável da mesma tarefa.** E aqui está a
armadilha que este contrato precisa cobrir: o banco **não barra isso na
criação**. A única validação está na policy de `insert` em `revisoes`
([:588](../supabase/schema.sql#L588)), ou seja, **na hora de revisar** —
possivelmente semanas depois. Uma tarefa criada com revisor igual ao
responsável nasce válida, vive normalmente e só falha quando alguém tenta
fechar o ciclo.

Por isso é validação de contrato, obrigatória antes de publicar.

Sem revisor, a entrega conclui a tarefa direto, sem passar por revisão.

### A.6 `local_entrega`: só `http`/`https` vira link

Regra implementada em [lib/links.ts:39](../lib/links.ts#L39):

| Valor | Como aparece |
|---|---|
| `https://github.com/org/repo/pull/42` | **link clicável**, encurtado para `github.com/…/pull/42` |
| `http://exemplo.com/a` | **link clicável** |
| `javascript:alert(1)` · `data:text/html,…` | **anotação em texto**, nunca `href` |
| `drive.google.com/algo` (sem esquema) | **anotação em texto** |
| `entregar impresso na aula de quinta` | **anotação em texto** |

Não é uma observação, é a regra: **só `http:` e `https:` viram `href`.**
`new URL()` aceita `javascript:` de bom grado, então a checagem de protocolo é
o que impede um campo de texto preenchido pela equipe de virar link
executável. O valor completo fica sempre no `title`.

O campo é `text` livre — anotação é uso legítimo, não erro. Mas se a intenção
era um link, um valor sem `https://` vira texto morto sem aviso nenhum.

### A.7 `issue_numero`

Número da issue no repositório do time. Serve para **cruzar a tarefa do painel
com o trabalho no Git**: a página `/codigo` e o selo no cartão consultam a API
do GitHub por esse número e mostram se a issue está aberta ou fechada.

É o único elo entre uma tarefa e a evidência versionada dela. Sem ele, a
tarefa existe no painel e o commit existe no GitHub, e nada liga os dois — o
que enfraquece exatamente a evidência que o PI avalia. A integração é
**somente leitura**: o painel nunca cria nem fecha issue.

### A.8 `unidade` não é campo de tarefa

Não existe `tarefas.unidade`. A unidade de estudo (POO, Modelagem, Lógica, BI,
Autoconhecimento) é propriedade da **frente**, em `frentes.unidade`
([:13](../supabase/schema.sql#L13)), e a tarefa a alcança pelo `frente_id`.

**Quem cria tarefa não informa unidade.** Informar é erro de validação. Para
mudar a unidade de uma tarefa, muda-se a frente dela.

---

## B. Campos que o banco ou a página preenchem — não envie

| Campo | Quem preenche | O que acontece se você enviar |
|---|---|---|
| `id` | `bigserial` ([:51](../supabase/schema.sql#L51)) | Valor ignorado ou conflito de chave. Nunca envie. |
| `criador_id` | **a sessão de quem publica** | **Sobrescrito, sempre.** Ver B.1. |
| `status` | default `'pendente'` ([:62](../supabase/schema.sql#L62)) | **Erro de validação.** Ver B.2. |
| `inicio` | trigger, quando o status vira `fazendo` ([:463-464](../supabase/schema.sql#L463-L464)) | Aceito pelo banco, mas ver B.2 — é sintoma de tarefa nascendo com status errado. |
| responsáveis de tarefa de **frente** | trigger `atribuir_responsaveis_frente` ([:240](../supabase/schema.sql#L240)) | **Erro de validação.** Ver A.4. |
| `concluido_em` | trigger, quando o status vira `concluida` ([:462](../supabase/schema.sql#L462)) | Sobrescrito na primeira mudança de status. |
| `commit_confirmado_em` | trigger de `entregas` ([:77-80](../supabase/schema.sql#L77-L80)) | Zerado na primeira reentrega. |
| `subiu_git` | default `false` ([:69](../supabase/schema.sql#L69)) | Aceito, mas é marcação manual da equipe sobre trabalho já feito — não faz sentido numa tarefa que está nascendo. |
| `arquivada` | default `false` ([:81](../supabase/schema.sql#L81)) | Criar já arquivada é criar invisível. Não envie. |
| `criado_em`, `atualizado_em` | `default now()` ([:83-84](../supabase/schema.sql#L83-L84)) | `atualizado_em` é reescrito a cada UPDATE pelo trigger. |

### B.1 `criador_id` é da sessão, não do objeto

`criador_id` **não é campo de entrada** e não aparece no objeto. Ele é
preenchido com o `id` de quem está publicando, e **qualquer valor presente no
objeto é ignorado**.

O motivo é a Trilha. Todo INSERT em `tarefas` grava linha em `historico` com
`auth.uid()` como autor ([:535](../supabase/schema.sql#L535)), e `historico` é
append-only — é a evidência de divisão de trabalho que o PI é avaliado.
Autoria reivindicável por um campo em texto colado quebra essa evidência:
bastaria escrever o id de outra pessoa para que o trabalho aparecesse como
dela.

É a mesma razão pela qual a publicação usa `signInWithPassword` e nunca
`service_role`: sem sessão, `auth.uid()` é `null` e as tarefas entram na Trilha
como trabalho de ninguém.

### B.2 O contrato proíbe criar com status diferente de `pendente`

Toda tarefa nasce `pendente`. Enviar `status` é erro de validação.

O motivo é concreto. O preenchimento automático de `inicio` existe **só no
ramo `UPDATE`** do trigger `registrar_historico`
([:463-464](../supabase/schema.sql#L463-L464)); o ramo `INSERT`
([:447](../supabase/schema.sql#L447)) só grava a linha `criou`. Uma tarefa
criada diretamente como `"fazendo"` fica com **`inicio` nulo para sempre** — e
como a duração dela sai de `inicio`, ela some das contas de duração do Sprint
Report sem nenhum erro visível.

Quem quiser começar a tarefa imediatamente **cria e move no quadro**, que é o
caminho que dispara o `UPDATE` e preenche `inicio`.

---

## C. O que não existe no painel

**Esforço e dependência não têm coluna.** Não existe `esforco`, `estimativa`,
`depende_de` nem tabela de dependências. Verificável no `create table` de
`tarefas` ([:50-86](../supabase/schema.sql#L50-L86)).

Se forem registrados, é como **texto solto em `observacoes`** — e com a
ressalva escrita: nada valida o formato, nada agrega, nada audita, e nenhum
relatório enxerga. Duas pessoas escrevendo "Esforço: 3h" e "esforço estimado
~3 horas" produzem dados que não se somam.

**Não invente campo.** Chave desconhecida no objeto é erro de validação. Se um
atributo novo for realmente necessário, ele vira coluna por migração — e
migração está fora do escopo destes três consumidores.

---

## D. Objeto de handoff

Um objeto JSON por tarefa. O script e a página aceitam **um objeto ou um array
de objetos**.

### Forma

```jsonc
{
  "titulo":        "string, obrigatório",
  "descricao":     "string | null",
  "escopo":        "individual | frente",
  "frente":        "nome da frente | null",     // obrigatório se escopo = frente
  "responsavel":   "nome do membro | null",     // proibido se escopo = frente
  "revisor":       "nome do membro | null",     // ≠ responsavel
  "prioridade":    "baixa | media | alta",      // omitido = media
  "prazo":         "AAAA-MM-DD | null",
  "local_entrega": "URL http(s) ou anotação | null",
  "issue_numero":  123,
  "observacoes":   "string | null"
}
```

Todo rótulo é **chave**. Nenhum valor começa com o nome do próprio campo.

### Exemplo: tarefa individual

```json
{
  "titulo": "Implementar conversão entre bases numéricas",
  "descricao": "Converter entre bases 2, 8, 10 e 16, com validação de entrada.\n\n- [ ] Função de conversão\n- [ ] Tratamento de entrada inválida\n- [ ] Testes com valores de borda",
  "escopo": "individual",
  "frente": "Lógica de Programação",
  "responsavel": "João Hélio",
  "revisor": "Diana Barros",
  "prioridade": "alta",
  "prazo": "2026-09-19",
  "local_entrega": "https://github.com/joaohelio-feob/apppi/pull/42",
  "issue_numero": 42,
  "observacoes": null
}
```

`frente` aqui é a **matéria** da tarefa, não muda quem responde por ela — o
responsável continua sendo uma pessoa só.

### Exemplo: tarefa de frente

```json
{
  "titulo": "Montar a apresentação final da frente",
  "descricao": "Slides e roteiro para a banca.\n\n- [ ] Estrutura dos slides\n- [ ] Ensaio cronometrado\n- [ ] Revisão da professora",
  "escopo": "frente",
  "frente": "Modelagem de Dados",
  "revisor": "João Hélio",
  "prioridade": "media",
  "prazo": "2026-10-03",
  "local_entrega": null,
  "issue_numero": null,
  "observacoes": null
}
```

Repare: **não há chave `responsavel`**. O trigger atribui todos os integrantes
da frente. Incluí-la aqui seria erro de validação, e `revisor` precisa ser
alguém que **não** está nessa frente.

---

## D.1 Como publicar

```bash
node scripts/publicar-tarefas.mjs scripts/exemplo-tarefas.json --dry-run   # só valida
node scripts/publicar-tarefas.mjs scripts/exemplo-tarefas.json             # publica
```

**Requisito de Node: nenhum além do que o projeto já usa.** A regra de
comparação de nomes é compartilhada entre o script e a página `/publicar`, e
mora em [lib/nomes.mjs](../lib/nomes.mjs) — **ESM puro, não TypeScript, de
propósito**. Um `lib/nomes.ts` importado pelo script exigiria *type stripping*
do Node, que não existe no **Node 20** fixado em
[.github/workflows/ci.yml:15](../.github/workflows/ci.yml#L15) — ou seja, o
script quebraria justamente na versão que o projeto padroniza. Os tipos vivem
em `lib/nomes.d.mts`, então quem consome pelo TypeScript continua tipado, e
não há passo de build nem piso de versão.

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública; sozinha **não** passa no RLS |
| `PI_EMAIL` / `PI_SENHA` | credenciais do membro que publica |

A sessão é obrigatória **mesmo no `--dry-run`**: as listas de `frentes` e
`membros` estão atrás de RLS `to authenticated`, e sem elas não há como
validar nome nenhum.

**Nada de `service_role`.** Ela contorna as policies, e sem sessão `auth.uid()`
é `null` — toda tarefa entraria na Trilha como trabalho de ninguém, que é
exatamente a evidência que o PI avalia.


## E. Checklist de validação

Roda sobre cada objeto **antes de tocar no banco**. Um objeto reprovado
**recusa o lote inteiro**: não existe policy de `DELETE` em `tarefas`, então
não há rollback — tarefa criada por engano só pode ser arquivada, e a linha
dela na Trilha fica para sempre.

| # | Verificação | Erro real que ela pega |
|---|---|---|
| 1 | `titulo` não vazio depois de `trim()` | objeto gerado sem título |
| 2 | Nenhum valor começa com o nome do próprio campo (`"Descrição: …"`, `"Título: …"`) | **rótulo dentro do valor** — foi assim que as tarefas atuais ficaram sujas |
| 3 | `titulo` não tem caractere faltando no começo (`"mplementar"`) | truncamento na origem, antes de chegar no painel |
| 4 | Nenhuma chave fora da seção A | campo inventado (`esforco`, `unidade`, `criador_id`) |
| 5 | `unidade` ausente | **unidade informada na tarefa** — ela vem de `frentes.unidade` |
| 6 | `status` ausente | tarefa nascendo `fazendo`, com `inicio` nulo para sempre |
| 7 | `escopo` é exatamente `individual` ou `frente` | typo silencioso, único caso que o banco também pega |
| 8 | `prioridade` ∈ {baixa, media, alta} | **o banco aceitaria lixo** — sem check nessa coluna |
| 9 | `escopo: "frente"` ⟹ `frente` presente | constraint `tarefa_de_frente_tem_frente` |
| 10 | `escopo: "frente"` ⟹ `responsavel` **ausente** | pessoa achando que escolheu uma pessoa, quando o trigger atribui a frente toda |
| 11 | `frente` e `responsavel` e `revisor` resolvem para exatamente um registro | nome inexistente ou ambíguo (dois "João") |
| 12 | `revisor` ≠ `responsavel` | **revisor igual ao responsável** — o banco só barra semanas depois, ao revisar |
| 13 | `revisor` não está na frente, quando `escopo: "frente"` | mesma armadilha, pela via do trigger |
| 14 | `prazo` casa `AAAA-MM-DD` e é data real | `"19/09/2026"` ou `"2026-02-30"` |
| 15 | `local_entrega`, se pretende ser link, começa com `http://` ou `https://` | **local_entrega que não é URL** — vira texto morto sem aviso |
| 16 | `revisor` não aparece dentro de `observacoes` | **revisor em observacoes** — segunda fonte de verdade |
| 17 | `issue_numero` é inteiro ≥ 1 | `"#42"` como string |

Itens 2, 3, 15 e 16 existem porque **já aconteceram** neste painel.
