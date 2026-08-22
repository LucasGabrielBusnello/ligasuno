# Simulador Clínico na aba Aluno

A aba "Aluno" passa a ser o simulador de treino em semiologia e clínica médica. Todo o conteúdo atual (cronograma, matérias, agenda pessoal) vai para um botão "Área de Testes", acessível somente pela sua conta.

## 1. Reorganização da aba Aluno

- `/aluno` passa a mostrar o painel de treino, aberto para usuários logados.
- Botão discreto "Área de Testes" no topo, visível e funcional apenas para `lucassgabrielbusnello@gmail.com.br` (checagem no servidor, não só no navegador). Todo o conteúdo atual do cronograma se mantém intacto lá dentro.

## 2. Banco de casos clínicos

Casos com: título, área médica, nível (1º a 6º ano), resumo, dados de triagem, história completa do paciente, personalidade e nível de "leiguice" (0-10), achados de exame físico por manobra, exames complementares disponíveis com resultado (texto e/ou imagem + laudo), diagnóstico final, conduta esperada e imagem do paciente coerente com o quadro.

- Lote inicial gerado por IA no estilo das provas (ENAMED/Revalida), distribuído por área e por ano. Não copio provas protegidas — os casos são originais no mesmo formato e estilo.
- Painel Admin com CRUD e importador para você acrescentar, editar ou remover casos.

Áreas contempladas: Clínica Médica, Cardiologia, Pneumologia, Gastroenterologia, Nefrologia, Endocrinologia, Neurologia, Reumatologia, Infectologia, Hematologia, Dermatologia, Psiquiatria, Pediatria, Ginecologia e Obstetrícia, Cirurgia Geral, Ortopedia, Urologia, Oftalmologia, Otorrinolaringologia, Geriatria, Medicina de Família e Comunidade, Emergência/Medicina Intensiva, Oncologia. Também dá para deixar em "Todas as áreas".

## 3. Treino Completo

Fluxo: escolher nível (1º ao 6º ano) + área (ou aleatória) → o sistema sorteia um caso e abre a estação.

Tela da estação:
- Foto do paciente + cronômetro.
- Aba **Triagem** já preenchida (sinais vitais, queixa de entrada, dados básicos).
- Aba **Conversa** com o paciente-IA, por voz ou por texto (mesmo comportamento nos dois modos). A IA responde no personagem, no nível de leiguice do caso: em 0 não usa termo técnico nenhum; em 10 solta termos técnicos e "palpites" de diagnóstico, alguns certos e outros errados de propósito, sempre coerentes com o que já falou — pegadinhas realistas, nunca confiável.
- Aba **Anamnese** para o aluno redigir.
- **Exame físico**: quando o aluno diz "vou auscultar seu coração", "vou palpar o abdome" etc., o paciente responde no personagem e aparece um balão na tela com o achado daquela manobra específica.
- **Ausculta/percussão com som**: quando a manobra tem som, aparece um player. Para pulmão, botões separados por região (ápice D/E, região média D/E, base D/E); para abdome, por quadrante; para coração, pelos focos (aórtico, pulmonar, tricúspide, mitral); mais carótidas e percussão. Cada botão toca alguns segundos do achado daquele ponto.
- Botão **Solicitar Exame Complementar**: escolhe o exame e recebe o resultado na hora — texto, ou imagem + laudo quando for exame de imagem.

## 4. Correção e nota

Ao finalizar, a anamnese + exames pedidos + hipótese vão para a IA corrigir:
- Nota de 0 a 100 do raciocínio clínico, com cores: ≥90 verde, ≥70 amarelo, <70 vermelho claro, <40 vermelho escuro, muito baixo preto.
- Exames pedidos sem justificativa (nem para afastar hipótese) descontam pontos; ser resolutivo sem desgastar o paciente sustenta a nota alta.
- Parecer escrito: o que foi bem, o que faltou, o que melhorar.

Feedback do aluno sobre o parecer: 👍 registra direto; 👎 abre um campo obrigatório "o que deveria melhorar".

## 5. Admin — treinamento da IA

Nova aba no Admin com os feedbacks negativos recebidos. Você aprova ou rejeita cada um; ao aprovar, o texto vira uma regra de correção que passa a ser aplicada nas próximas correções — e você pode editar, complementar ou excluir essas regras a qualquer momento.

## Sobre sons de ausculta

Busco repositórios de sons de ausculta com licença aberta e importo o que for permitido, mapeando por região/achado. Onde não houver som livre disponível para um achado, fica a descrição escrita e o painel Admin permite subir o arquivo depois.

## Detalhes técnicos

- Tabelas novas: `sim_cases`, `sim_case_exams`, `sim_case_findings`, `sim_auscultation_sounds`, `sim_sessions`, `sim_messages`, `sim_feedback`, `sim_ai_rules` — todas com RLS (aluno lê o público e só as próprias sessões; escrita de conteúdo restrita a admin) e GRANTs.
- Buckets: `sim-audio` e `sim-media` (públicos, leitura livre / escrita admin) para sons, imagens de paciente e exames de imagem.
- IA via Lovable AI Gateway com `google/gemini-3-flash` (modelo rápido e barato, adequado a uso intenso; o consumo de créditos existe, mas é o menor caminho para não travar o aluno no meio do caso). Chamadas em server functions com streaming.
- Voz: gravação no navegador enviada como áudio ao modelo multimodal para entender a fala, e resposta falada por text-to-speech do gateway; se a voz falhar, cai automaticamente para texto sem perder a sessão.
- Estado da sessão persistido a cada turno, para o aluno poder retomar um caso.
