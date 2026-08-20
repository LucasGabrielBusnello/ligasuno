export const TERMS_VERSION = "1.0";

export const TERMS_TITLE = "Termos de Uso e Política de Privacidade — MEDPLEX";

export const NOT_OFFICIAL_NOTICE =
  "MEDPLEX é uma plataforma independente, criada e mantida por estudantes. Não é um canal oficial de comunicação da Unochapecó, do curso de Medicina, do CAMED, da atlética ou de qualquer entidade. O conteúdo publicado é de responsabilidade de quem o envia e não reflete o posicionamento dessas instituições.";

export type TermsClause = { n: number; title: string; body: string };

export const TERMS_CLAUSES: TermsClause[] = [
  {
    n: 1,
    title: "Natureza da plataforma",
    body: "O MEDPLEX é uma plataforma estudantil independente, sem vínculo institucional, societário ou representativo com a Unochapecó ou com qualquer instituição de ensino. Não constitui via oficial de comunicação da universidade, do curso de Medicina, da coordenação, do CAMED, das ligas acadêmicas, da atlética ou de qualquer outra entidade citada. Informações aqui publicadas não substituem os canais oficiais dessas entidades, e o usuário se compromete a confirmar nos canais oficiais qualquer informação de caráter acadêmico, financeiro ou institucional.",
  },
  {
    n: 2,
    title: "Conteúdo de terceiros",
    body: "Grande parte do conteúdo (cronogramas, notícias, documentos, eventos, anúncios, valores, imagens) é enviada por usuários, diretores, ligas, atlética, CAMED, IFMSA e parceiros. Esse conteúdo é de responsabilidade exclusiva de quem o publicou e não reflete a opinião ou o posicionamento do MEDPLEX, de seus mantenedores ou das instituições mencionadas.",
  },
  {
    n: 3,
    title: "Sem garantia de exatidão",
    body: "A plataforma é fornecida \u201cno estado em que se encontra\u201d, sem garantia de disponibilidade contínua, ausência de erros, exatidão ou atualização das informações. Horários, datas, notas, vagas, valores e documentos podem estar desatualizados ou incorretos. O usuário assume o risco de decisões tomadas com base nas informações do site.",
  },
  {
    n: 4,
    title: "Dados pessoais coletados",
    body: "Ao criar conta e usar a plataforma, você fornece e/ou gera: nome completo, nome de usuário, e-mail, telefone/WhatsApp, CPF, data de nascimento, matrícula, curso, turma (ATM), semestre, foto/avatar, assinatura digital quando aplicável, registros de presença e check-in, inscrições em eventos, minicursos e processos seletivos, respostas de provas e quizzes, histórico de pagamentos (status, valores, comprovantes), indicações, além de dados técnicos de acesso (data/hora, páginas visitadas, IP e identificador do dispositivo).",
  },
  {
    n: 5,
    title: "Compartilhamento com ligas e entidades",
    body: "Você entende e concorda que, ao se inscrever, se associar ou participar de uma liga acadêmica, da atlética, do CAMED, da IFMSA, de eventos, minicursos ou processos seletivos, seus dados pessoais — inclusive nome, e-mail, telefone, CPF, data de nascimento, matrícula, curso, turma, semestre, foto, situação de pagamento, presença e desempenho em provas — ficam visíveis para os diretores, presidentes e administradores dessas entidades, para fins de gestão, cobrança, emissão de certificados, controle de presença e comunicação. O MEDPLEX não controla o uso posterior que essas pessoas fazem desses dados e não se responsabiliza por ele; cada entidade é controladora independente dos dados que acessa.",
  },
  {
    n: 6,
    title: "Outras hipóteses de compartilhamento",
    body: "Dados podem ser compartilhados com prestadores de serviço necessários ao funcionamento (hospedagem, banco de dados, provedores de e-mail, processadores de pagamento como Mercado Pago e InfinitePay) e com autoridades quando exigido por lei ou ordem judicial. Não vendemos dados pessoais.",
  },
  {
    n: 7,
    title: "Pagamentos",
    body: "Cobranças de semestralidade, ingressos, produtos, associações e inscrições são definidas e recebidas diretamente pelas ligas, atlética ou entidade organizadora, por meio de seus próprios provedores de pagamento. O MEDPLEX apenas intermedeia tecnicamente o registro da cobrança e não é parte da relação de consumo, não retém os valores e não é responsável por reembolsos, estornos, cancelamentos, taxas cobradas pelos provedores ou pela entrega do produto/serviço contratado.",
  },
  {
    n: 8,
    title: "Obrigações do usuário",
    body: "Você declara que os dados informados são verdadeiros, que a conta é pessoal e intransferível, e que é responsável por manter sua senha em sigilo. É proibido: publicar conteúdo ilegal, ofensivo, discriminatório, difamatório ou que viole direitos de terceiros; publicar dados pessoais de outras pessoas sem autorização; usar a plataforma para fraude, spam, assédio ou para se passar por outra pessoa ou entidade; tentar burlar mecanismos de segurança, extrair dados em massa ou sobrecarregar o sistema.",
  },
  {
    n: 9,
    title: "Conteúdo enviado por você",
    body: "Ao enviar textos, imagens ou arquivos, você declara ter os direitos necessários e concede ao MEDPLEX licença gratuita e não exclusiva para armazenar e exibir esse conteúdo dentro da plataforma. O MEDPLEX pode remover conteúdo e suspender ou excluir contas que violem estes termos, a qualquer tempo e sem aviso prévio.",
  },
  {
    n: 10,
    title: "Propriedade intelectual de terceiros",
    body: "Logos, marcas e materiais da Unochapecó, ligas, atlética, CAMED, IFMSA e parceiros pertencem a seus respectivos titulares e são exibidos apenas para identificação, sem implicar patrocínio, endosso ou parceria com o MEDPLEX.",
  },
  {
    n: 11,
    title: "Limitação de responsabilidade",
    body: "Na máxima extensão permitida pela legislação, o MEDPLEX e seus mantenedores não respondem por danos diretos, indiretos, lucros cessantes, perda de dados, prejuízos acadêmicos ou financeiros decorrentes do uso ou da impossibilidade de uso da plataforma, de informações incorretas, de indisponibilidade, de conteúdo de terceiros, de conduta de outros usuários ou de falhas de provedores externos. Se alguma responsabilidade for reconhecida, ela fica limitada ao valor eventualmente pago por você diretamente ao MEDPLEX, que hoje é zero.",
  },
  {
    n: 12,
    title: "Segurança",
    body: "Adotamos medidas técnicas razoáveis de proteção (controle de acesso por perfil, criptografia em trânsito, políticas de acesso no banco de dados). Nenhum sistema é totalmente seguro, e você reconhece que incidentes podem ocorrer apesar dos esforços razoáveis.",
  },
  {
    n: 13,
    title: "Seus direitos (LGPD)",
    body: "Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus dados, e revogar consentimentos, pelo canal de contato indicado na plataforma. A exclusão da conta não apaga registros que precisem ser mantidos por obrigação legal, para defesa em processos ou para integridade de registros financeiros e de certificados já emitidos, nem apaga cópias já obtidas por entidades com as quais você compartilhou dados.",
  },
  {
    n: 14,
    title: "Retenção",
    body: "Os dados são mantidos enquanto a conta existir e pelo prazo necessário às finalidades acima ou a obrigações legais.",
  },
  {
    n: 15,
    title: "Menores de idade",
    body: "Usuários com menos de 18 anos declaram estar autorizados por seus responsáveis legais a utilizar a plataforma e a fornecer os dados solicitados.",
  },
  {
    n: 16,
    title: "Comunicações",
    body: "Ao criar conta, você autoriza o envio de e-mails e mensagens (inclusive WhatsApp) relacionados a cadastro, cobranças, eventos, certificados e avisos operacionais das entidades das quais participa.",
  },
  {
    n: 17,
    title: "Alterações",
    body: "Estes termos podem ser alterados a qualquer momento. Alterações relevantes exigirão novo aceite; o uso continuado após a publicação implica concordância.",
  },
  {
    n: 18,
    title: "Encerramento",
    body: "Podemos suspender ou encerrar a plataforma, no todo ou em parte, a qualquer momento, sem obrigação de indenizar.",
  },
  {
    n: 19,
    title: "Lei aplicável e foro",
    body: "Aplica-se a legislação brasileira, elegendo-se o foro da comarca de Chapecó/SC, com renúncia a qualquer outro.",
  },
  {
    n: 20,
    title: "Aceite",
    body: "Ao marcar \u201cLi e aceito\u201d, você declara ter lido e compreendido integralmente estes termos, em especial os itens 1, 5, 7 e 11.",
  },
];
