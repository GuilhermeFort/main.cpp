# Detetives em Dupla — Realism Expansion

Este documento fixa o escopo completo pedido para transformar o jogo em um simulador cooperativo persistente.

## Núcleo imutável do caso
- Bíblia do caso congelada no momento da geração.
- Culpado, cúmplices, motivo, método, cronologia, evidências e red herrings imutáveis.
- Verdade global separada da percepção individual.
- Validação de toda resposta contra fatos canônicos.
- Nenhuma afirmação/blefe do jogador altera a realidade.

## Pessoas simuladas
- Perfil psicológico persistente por NPC.
- Voz, vocabulário, formalidade, gírias e tamanho de frase próprios.
- Medo, raiva, ansiedade, confiança, vergonha, culpa, hostilidade, cooperação, cansaço e percepção de risco.
- Memória verdadeira, memória percebida e versão declarada separadas.
- Conhecimento privado limitado por personagem.
- Relações NPC↔NPC e NPC↔cada detetive.
- Segredos secundários, rumores, preconceitos, lealdades e objetivos.
- Mentiras motivadas e confissões graduais.
- Reações persistentes a acusações, respeito, blefes e evidências.

## Interrogatório
- Perguntas abertas/fechadas, rapport, silêncio, confronto, repetição, blefe, cronologia reversa.
- Apresentação de evidência real com peso probatório.
- Detecção de contradições sem declarar automaticamente mentira.
- Histórico oficial e comparação de depoimentos.
- Suspeito pode recusar, pedir advogado ou encerrar conversa.
- Confissão depende de evidência + psicologia + colapso da versão, nunca de comando mágico.

## Evidências e perícia
- Inventário EV-001... com cadeia de custódia.
- Local/hora/coletor/fotos/embalagem/laboratório/confiabilidade/histórico.
- DNA, digitais, toxicologia, fibras, cabelos, sangue, solo, vidro, documentos, marcas de ferramenta e outros exames compatíveis com o caso.
- Resultados probabilísticos, inconclusivos, contaminados e amostra insuficiente.
- Especialistas separados: legista, toxicologista, perito digital, papiloscopista etc.

## Perícia digital
- Celular: chamadas, mensagens, arquivos apagados, fotos, metadados, GPS quando existente, Wi-Fi e Bluetooth.
- Computador: logins, navegador, arquivos recentes, dispositivos conectados e logs.
- Tecnologia limitada pelo que o dispositivo realmente registra.

## Câmeras e localização
- Câmeras individuais por local/horário.
- Ponto cego, baixa qualidade, relógio incorreto, ausência de áudio e falhas possíveis.
- Mapa com trajeto confirmado versus trajeto alegado.
- Timeline com CONFIRMADO / ALEGADO / ESTIMADO.

## Ferramentas dos detetives
- Caderno: notas, pessoas, evidências, contradições, timeline, hipóteses, pendências, perguntas e favoritos.
- Quadro policial visual com conexões manuais.
- Hipóteses com evidências favoráveis/contrárias e perguntas abertas, sem revelar acerto.
- Salvar mensagens/depoimentos como notas citáveis.
- Comparar dois depoimentos.
- Informação privada por jogador + mural compartilhado.

## Mundo persistente
- NPCs podem reagir a acontecimentos e conversar entre si quando coerente.
- Telefonemas/notificações de resultados e novos acontecimentos pré-definidos.
- Tempo narrativo, perícias pendentes e opção de acelerar tempo.
- Rotina/indisponibilidade coerente de personagens sem criar espera artificial.

## Busca em locais
- Locais divididos em áreas pesquisáveis.
- Itens existentes definidos na Bíblia do Caso.
- Busca não inventa evidência.
- Exames disponíveis dependem do item encontrado.

## Procedimento jurídico
- Pedidos de autorização/mandado quando apropriado à ficção.
- Promotor como teste da suficiência probatória.
- Prisão não encerra automaticamente o caso.
- Acusação final exige suspeito + motivo + método + evidências.
- Julgamento opcional em que a defesa testa a investigação.

## Cooperação
- Dois investigadores simultâneos e distintos.
- Conversas privadas e descobertas privadas.
- Evidências compartilháveis explicitamente.
- Contradições entre entrevistas paralelas não são reveladas automaticamente.

## Final e avaliação
- Revelação completa somente após encerramento apropriado.
- Pontuação de culpado, motivo, método, cronologia, evidências fundamentais, contradições, erros investigativos e sustentabilidade probatória.
- Replay mostrando pistas perdidas e explicação dos red herrings.

## Regra de implementação
O Gemini interpreta o mundo; não cria retroativamente a verdade. O banco mantém o estado canônico e persistente. Toda ferramenta deve consultar o estado antes de produzir resultado. Nenhuma mecânica pode fabricar uma evidência decisiva apenas para satisfazer uma pergunta do jogador.
