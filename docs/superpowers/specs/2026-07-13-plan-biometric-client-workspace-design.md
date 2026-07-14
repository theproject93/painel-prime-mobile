# Plan IA resiliente e workspace premium de Clientes

## Objetivo

Corrigir o bloqueio biométrico disparado durante perguntas à Plan IA e transformar a aba Clientes em uma jornada nativa completa: dados do cliente, próximos passos comerciais, documentos, assinatura e inteligência de leitura Papermark. A assessoria também poderá editar, versionar e visualizar seus modelos de orçamento e contrato no Android.

## Decisões de produto

- A lista de Clientes continua curta e orientada à próxima ação.
- “Ver detalhes” deixa de abrir um formulário genérico e navega para um workspace dedicado do cliente.
- O editor de modelos é global à assessoria e fica acessível pelo cabeçalho de Clientes; não é duplicado dentro de cada cliente.
- O Android reutiliza as tabelas, RPCs, Edge Functions e APIs autenticadas existentes. Nenhum fluxo do Portal do Cliente será alterado.
- O teste físico e o APK serão executados uma única vez, depois de toda a implementação e das validações estáticas.

## 1. Biometria e Plan IA

### Causa

O provider biométrico observa o objeto `user`. Uma renovação de sessão cria uma nova instância desse objeto, executa novamente a inicialização biométrica e bloqueia a interface como se fosse um novo login. A Plan IA força `refreshSession()` antes de cada mensagem, portanto a pergunta dispara o problema.

### Correção

- A identidade biométrica será vinculada apenas ao `user.id`.
- A inicialização biométrica acontecerá uma vez por conta/sessão, não em eventos `TOKEN_REFRESHED`.
- Apenas o estado real `background` inicia o relógio de relock. `inactive`, diálogos do sistema e renovações silenciosas não devem bloquear o app.
- A Plan IA utilizará a sessão atual e renovará o JWT somente quando ausente, próximo da expiração ou depois de HTTP 401.
- Mensagens e rascunho serão persistidos no AsyncStorage por usuário, com limite local de 30 mensagens. Não serão persistidos JWT, prompts enriquecidos, respostas internas ou secrets.
- A mensagem do usuário é persistida antes da chamada de rede; assim uma interrupção não apaga a pergunta.

## 2. Workspace do cliente

Nova rota nativa: `/(app)/(tabs)/clientes/[clientId]`.

### Hierarquia

1. Hero compacto com nome, tipo/data do evento e estado da jornada.
2. Card “Próximo passo” com uma única ação primária.
3. Linha comercial visual: cadastro → orçamento → contrato → assinatura.
4. Dados essenciais editáveis em sheet: contato, evento, valor e observações.
5. Documentos: orçamento e contrato, com versão/status, abrir, gerar/enviar novamente quando aplicável.
6. Inteligência Papermark, exibida somente quando houver proposta Papermark:
   - termômetro comercial e score;
   - total de visualizações;
   - tempo total e última leitura;
   - visitante mais recente;
   - páginas mais vistas;
   - linha do tempo recente;
   - atualizar métricas e abrir proposta.

Estados vazios devem explicar o próximo passo em linguagem de assessoria, sem termos técnicos de integração.

## 3. Editor de modelos

Nova rota nativa: `/(app)/(tabs)/clientes/modelos`.

- Alternância Orçamento/Contrato.
- Carregamento do modelo ativo via `get_active_template`.
- Defaults compatíveis com o formato Web `visual_blocks`.
- Edição de nome, descrição, cor de destaque, alinhamento, margem e rodapé.
- Blocos reordenáveis por botões subir/descer, habilitáveis e editáveis.
- Chips de variáveis inserem placeholders seguros no bloco selecionado.
- Prévia nativa representa cabeçalho, títulos, texto e destaque financeiro sem executar HTML.
- Salvar cria nova versão por `create_template_version`; nunca sobrescreve uma versão usada por documento anterior.
- Em caso de conflito ou rede instável, o rascunho local permanece e a interface oferece tentar novamente.

## 4. Dados e segurança

- Tenant obtido de `tenant_memberships` para o usuário autenticado.
- Leitura/escrita de modelos respeita RLS e RPCs existentes.
- Métricas Papermark são obtidas da API Web autenticada por JWT, com fallback para o snapshot seguro em `external_metadata`.
- Nenhuma chave Papermark, Documenso ou Supabase de servidor entra no bundle Android.
- Links externos são abertos somente após validação de esquema HTTP/HTTPS.

## 5. Testes e entrega

- Testes de política biométrica cobrem refresh de sessão, background curto/longo e diálogo `inactive`.
- Testes de persistência cobrem sanitização, limite e restauração da conversa.
- Testes puros cobrem normalização de métricas Papermark e payload/versionamento dos modelos.
- `tsc --noEmit`, `expo config --type introspect`, testes Deno, anti-mojibake, BOM/NUL e `git diff --check` são obrigatórios.
- Os arquivos mobile serão espelhados com identidade de blobs no monorepo.
- Um único smoke test final no Android validará biometria, envio à Plan, workspace do cliente, Papermark e modelos.
- Somente após aprovação do smoke será disparado um único build Android e o envio ao Firebase App Distribution.

## Fora de escopo

- Alterar Portal do Cliente, convite digital ou páginas públicas.
- Reimplementar Papermark/Documenso no dispositivo.
- Salvar senha para biometria.
- Gerar APK intermediário.
