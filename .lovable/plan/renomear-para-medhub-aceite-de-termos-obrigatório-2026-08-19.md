# Renomear para MEDHUB + Aceite de Termos obrigatório

## 1. Novo nome: MEDHUB

Troca apenas de interface e PWA (domínio atual permanece):
- Textos visíveis, títulos das páginas, metadados/SEO, `public/manifest.webmanifest` (name, short_name, description), prompt de instalação, cabeçalho, rodapés, assinaturas de e-mail e arquivos `.ics`.
- Nomes internos de tabelas, rotas e chaves não mudam.

## 2. Aviso de canal não oficial

Faixa discreta (texto pequeno, cinza) no rodapé da Página Inicial e da página do CAMED:

> MEDHUB é uma plataforma independente, criada e mantida por estudantes. Não é um canal oficial de comunicação da Unochapecó, do curso de Medicina, do CAMED, da atlética ou de qualquer entidade. O conteúdo publicado é de responsabilidade de quem o envia e não reflete o posicionamento dessas instituições.

## 3. Aceite obrigatório (bloqueante para todos)

- Nova página pública `/termos` com o texto completo e a versão vigente.
- Checkbox obrigatório no cadastro em `/auth`.
- Modal bloqueante logo após o login para quem ainda não aceitou a versão atual: só há dois caminhos — "Li e aceito" ou "Sair". Enquanto não aceitar, nenhuma outra tela é utilizável.
- Registro de aceite no banco: usuário, versão dos termos, data/hora e IP. Se você publicar uma nova versão dos termos, todos são solicitados a aceitar novamente.

## 4. Texto proposto dos Termos (para sua revisão antes de aplicar)

**Termos de Uso e Política de Privacidade — MEDHUB — Versão 1.0**

**1. Natureza da plataforma.** O MEDHUB é uma plataforma estudantil independente, sem vínculo institucional, societário ou representativo com a Unochapecó ou com qualquer instituição de ensino. Não constitui via oficial de comunicação da universidade, do curso de Medicina, da coordenação, do CAMED, das ligas acadêmicas, da atlética ou de qualquer outra entidade citada. Informações aqui publicadas não substituem os canais oficiais dessas entidades, e o usuário se compromete a confirmar nos canais oficiais qualquer informação de caráter acadêmico, financeiro ou institucional.

**2. Conteúdo de terceiros.** Grande parte do conteúdo (cronogramas, notícias, documentos, eventos, anúncios, valores, imagens) é enviada por usuários, diretores, ligas, atlética, CAMED, IFMSA e parceiros. Esse conteúdo é de responsabilidade exclusiva de quem o publicou e não reflete a opinião ou o posicionamento do MEDHUB, de seus mantenedores ou das instituições mencionadas.

**3. Sem garantia de exatidão.** A plataforma é fornecida "no estado em que se encontra", sem garantia de disponibilidade contínua, ausência de erros, exatidão ou atualização das informações. Horários, datas, notas, vagas, valores e documentos podem estar desatualizados ou incorretos. O usuário assume o risco de decisões tomadas com base nas informações do site.

**4. Dados pessoais coletados.** Ao criar conta e usar a plataforma, você fornece e/ou gera: nome completo, nome de usuário, e-mail, telefone/WhatsApp, CPF, data de nascimento, matrícula, curso, turma (ATM), semestre, foto/avatar, assinatura digital quando aplicável, registros de presença e check-in, inscrições em eventos, minicursos e processos seletivos, respostas de provas e quizzes, histórico de pagamentos (status, valores, comprovantes), indicações, além de dados técnicos de acesso (data/hora, páginas visitadas, IP e identificador do dispositivo).

**5. Compartilhamento com ligas e entidades.** Você entende e concorda que, ao se inscrever, se associar ou participar de uma liga acadêmica, da atlética, do CAMED, da IFMSA, de eventos, minicursos ou processos seletivos, seus dados pessoais — inclusive nome, e-mail, telefone, CPF, data de nascimento, matrícula, curso, turma, semestre, foto, situação de pagamento, presença e desempenho em provas — ficam visíveis para os diretores, presidentes e administradores dessas entidades, para fins de gestão, cobrança, emissão de certificados, controle de presença e comunicação. O MEDHUB não controla o uso posterior que essas pessoas fazem desses dados e não se responsabiliza por ele; cada entidade é controladora independente dos dados que acessa.

**6. Outras hipóteses de compartilhamento.** Dados podem ser compartilhados com prestadores de serviço necessários ao funcionamento (hospedagem, banco de dados, provedores de e-mail, processadores de pagamento como Mercado Pago e InfinitePay) e com autoridades quando exigido por lei ou ordem judicial. Não vendemos dados pessoais.

**7. Pagamentos.** Cobranças de semestralidade, ingressos, produtos, associações e inscrições são definidas e recebidas diretamente pelas ligas, atlética ou entidade organizadora, por meio de seus próprios provedores de pagamento. O MEDHUB apenas intermedeia tecnicamente o registro da cobrança e não é parte da relação de consumo, não retém os valores e não é responsável por reembolsos, estornos, cancelamentos, taxas cobradas pelos provedores ou pela entrega do produto/serviço contratado.

**8. Obrigações do usuário.** Você declara que os dados informados são verdadeiros, que a conta é pessoal e intransferível, e que é responsável por manter sua senha em sigilo. É proibido: publicar conteúdo ilegal, ofensivo, discriminatório, difamatório ou que viole direitos de terceiros; publicar dados pessoais de outras pessoas sem autorização; usar a plataforma para fraude, spam, assédio ou para se passar por outra pessoa ou entidade; tentar burlar mecanismos de segurança, extrair dados em massa ou sobrecarregar o sistema.

**9. Conteúdo enviado por você.** Ao enviar textos, imagens ou arquivos, você declara ter os direitos necessários e concede ao MEDHUB licença gratuita e não exclusiva para armazenar e exibir esse conteúdo dentro da plataforma. O MEDHUB pode remover conteúdo e suspender ou excluir contas que violem estes termos, a qualquer tempo e sem aviso prévio.

**10. Propriedade intelectual de terceiros.** Logos, marcas e materiais da Unochapecó, ligas, atlética, CAMED, IFMSA e parceiros pertencem a seus respectivos titulares e são exibidos apenas para identificação, sem implicar patrocínio, endosso ou parceria com o MEDHUB.

**11. Limitação de responsabilidade.** Na máxima extensão permitida pela legislação, o MEDHUB e seus mantenedores não respondem por danos diretos, indiretos, lucros cessantes, perda de dados, prejuízos acadêmicos ou financeiros decorrentes do uso ou da impossibilidade de uso da plataforma, de informações incorretas, de indisponibilidade, de conteúdo de terceiros, de conduta de outros usuários ou de falhas de provedores externos. Se alguma responsabilidade for reconhecida, ela fica limitada ao valor eventualmente pago por você diretamente ao MEDHUB, que hoje é zero.

**12. Segurança.** Adotamos medidas técnicas razoáveis de proteção (controle de acesso por perfil, criptografia em trânsito, políticas de acesso no banco de dados). Nenhum sistema é totalmente seguro, e você reconhece que incidentes podem ocorrer apesar dos esforços razoáveis.

**13. Seus direitos (LGPD).** Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus dados, e revogar consentimentos, pelo canal de contato indicado na plataforma. A exclusão da conta não apaga registros que precisem ser mantidos por obrigação legal, para defesa em processos ou para integridade de registros financeiros e de certificados já emitidos, nem apaga cópias já obtidas por entidades com as quais você compartilhou dados.

**14. Retenção.** Os dados são mantidos enquanto a conta existir e pelo prazo necessário às finalidades acima ou a obrigações legais.

**15. Menores de idade.** Usuários com menos de 18 anos declaram estar autorizados por seus responsáveis legais a utilizar a plataforma e a fornecer os dados solicitados.

**16. Comunicações.** Ao criar conta, você autoriza o envio de e-mails e mensagens (inclusive WhatsApp) relacionados a cadastro, cobranças, eventos, certificados e avisos operacionais das entidades das quais participa.

**17. Alterações.** Estes termos podem ser alterados a qualquer momento. Alterações relevantes exigirão novo aceite; o uso continuado após a publicação implica concordância.

**18. Encerramento.** Podemos suspender ou encerrar a plataforma, no todo ou em parte, a qualquer momento, sem obrigação de indenizar.

**19. Lei aplicável e foro.** Aplica-se a legislação brasileira, elegendo-se o foro da comarca de Chapecó/SC, com renúncia a qualquer outro.

**20. Aceite.** Ao marcar "Li e aceito", você declara ter lido e compreendido integralmente estes termos, em especial os itens 1, 5, 7 e 11.

## 5. Detalhes técnicos

- Nova tabela `terms_acceptances` (user_id, version, accepted_at, ip, user_agent) com RLS: usuário insere/lê apenas o próprio registro; admin_master lê todos. GRANTs para `authenticated` e `service_role`.
- Versão vigente em constante no código (`TERMS_VERSION`), comparada com o último aceite do usuário.
- Gate de aceite montado uma vez em `src/routes/__root.tsx`, ignorado nas rotas `/auth`, `/termos` e nas rotas de API públicas.
- Aviso de canal não oficial como componente reutilizável, usado em `src/routes/index.tsx` e `src/routes/camed.tsx`.
- Rename cobre `public/manifest.webmanifest`, `src/routes/*`, `src/components/site-header.tsx`, `install-prompt.tsx`, `maintenance-gate.tsx`, `profile-review-dialog.tsx`, `src/lib/ics.ts` e os textos de e-mail.

Se quiser ajustar, remover ou endurecer alguma cláusula, me diga antes de aprovar.
