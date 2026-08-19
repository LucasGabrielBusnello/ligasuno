# Admin > Usuários: edição, exclusão e controle de aceites dos termos

## O que muda

### 1. Excluir usuários
- Cada usuário na lista ganha um botão "Excluir" (ícone lixeira, vermelho) ao lado de "Editar".
- Confirmação obrigatória em diálogo, exigindo digitar o nome de usuário para confirmar (evita exclusão acidental).
- A exclusão remove a conta de login e o perfil. Registros ligados (inscrições, pagamentos, memberships) que dependem do usuário são desvinculados ou removidos conforme as regras já existentes no banco; se algum vínculo impedir a exclusão, o admin recebe uma mensagem clara explicando o motivo.
- Não é possível excluir a própria conta nem outro admin master.

### 2. Edição (melhorias)
- O diálogo de edição atual continua, com um bloco novo mostrando o status dos termos daquele usuário: versão aceita, data/hora, IP e navegador.

### 3. Sub-aba "Termos de Uso"
Dentro da aba Usuários, duas visões:

**Aceites**
- Lista de todos os aceites com: nome, @usuário, e-mail, versão aceita, data/hora (fuso de Brasília), IP e navegador.
- Busca por nome/e-mail/usuário e filtro por versão.
- Botão "Exportar CSV" com todos os dados dessa listagem (útil como prova documental).

**Versões e cobertura**
- Card com a versão vigente dos termos (hoje 1.0) e link para a página pública `/termos`.
- Contadores: total de usuários, quantos aceitaram a versão vigente, quantos estão pendentes, e a divisão por versão histórica.
- Lista dos usuários pendentes (ainda não aceitaram a versão atual), com busca.

## Detalhes técnicos

- Novas funções de servidor em `src/lib/admin-users.functions.ts` (todas com `requireSupabaseAuth` + verificação `admin_master` já existente via `assertAdmin`):
  - `deleteUserAdmin` — bloqueia auto-exclusão e exclusão de admin master; usa `auth.admin.deleteUser` e remove o perfil; traduz erros de chave estrangeira em mensagem legível.
  - `listTermsAcceptancesAdmin` — junta `terms_acceptances` com `profiles`, com busca e filtro por versão.
  - `getTermsCoverageAdmin` — totais por versão, contagem de pendentes e lista de usuários pendentes da versão vigente.
  - `getUserTermsAdmin` — aceites de um usuário específico, para o diálogo de edição.
- `src/routes/admin.tsx`: `UsersAdmin` passa a ter abas internas ("Cadastros" e "Termos de Uso"); botão de exclusão com diálogo de confirmação; novo bloco de termos no `AdminUserDialog`; exportação CSV gerada no cliente.
- A versão vigente vem de `TERMS_VERSION` em `src/lib/terms.ts`; nenhuma alteração de banco é necessária (a tabela `terms_acceptances` já guarda versão, data, IP e navegador, e já tem política de leitura para admin master).

## 4. Aceite dos termos obrigatório (reforço)

Já existe um modal bloqueante após o login; ele será endurecido para não haver como continuar sem aceitar:

- Verificação a cada troca de rota e ao voltar o foco à aba, além de no login — assim uma nova versão dos termos passa a bloquear imediatamente, sem precisar recarregar.
- Enquanto o aceite estiver pendente: rolagem da página travada, conteúdo de fundo inerte (sem cliques ou navegação por teclado) e nenhuma forma de fechar o modal (sem ESC, sem clique fora).
- Apenas duas saídas: "Li e aceito" (registra o aceite) ou "Sair" (encerra a sessão e volta para `/auth`).
- Exceções mantidas apenas para `/auth` e `/termos` (leitura do texto completo), e a versão pública de `/termos` continua acessível.
- Quando `TERMS_VERSION` mudar, todos voltam a ver o modal com o texto novo, e o novo aceite é gravado como um registro separado (mantendo o histórico anterior).
- Em falha de rede na verificação, o app não libera o acesso por engano: tenta novamente em vez de assumir que o usuário já aceitou.
