# Gemini como professor da IA própria

## Objetivo
Usar Gemini como teacher/evaluator durante o jogo para produzir e filtrar dados de alta qualidade que alimentam uma IA própria (student). O student não altera os próprios pesos durante uma conversa; aprendizado real ocorre em ciclos de treinamento offline/versionados.

## Pipeline
1. Interação real do jogo acontece.
2. Gemini produz a resposta do personagem/central.
3. Um avaliador classifica a interação em importância, qualidade, novidade e tipo de habilidade.
4. Ruído e duplicatas são descartados ou recebem expiração curta.
5. Exemplos fortes ficam em `ai_training_examples`.
6. Correções e preferências ficam em `ai_feedback`.
7. Memórias úteis para execução imediata ficam em `ai_memory_items`.
8. Periodicamente um dataset versionado é exportado para treinamento do student.
9. Cada versão treinada entra em `ai_model_versions`.
10. Student e Gemini respondem aos mesmos casos de avaliação.
11. Gemini atua como juiz, mas métricas objetivas também verificam consistência, fatos e formato.
12. Resultados ficam em `ai_evaluations`.
13. Só promover uma versão quando superar critérios mínimos.
14. Em produção, roteador gradual manda parte das respostas para student; Gemini supervisiona amostras e casos difíceis.
15. Quando o student atinge qualidade suficiente, Gemini deixa de ser gerador principal e vira fallback/auditor. Pode ser removido se o modelo próprio atingir o nível desejado e houver avaliação independente suficiente.

## O que salvar
- Interrogatórios difíceis e respostas naturais.
- Reações a prova verdadeira e blefe.
- Correções de contradições.
- Respostas em que personalidade foi mantida por histórico longo.
- Uso correto de conhecimento limitado.
- Central recusando conclusões impossíveis.
- Confissões graduais corretas.
- Resultados de perícia coerentes.
- Erros do Gemini junto da resposta corrigida.
- Casos em que o jogador avaliou a resposta como boa/ruim.
- Resultado final do caso e quais respostas ajudaram ou atrapalharam.

## O que descartar
- Saudações triviais.
- Duplicatas sem novidade.
- Respostas vazias ou quebradas.
- Texto puramente de interface.
- Conversas sem valor de aprendizado.
- Dados inconsistentes com a Bíblia do Caso.
- Exemplos sem contexto suficiente.
- Segredos/chaves/API tokens.

## Scores sugeridos
`importance_score`: quanto esse exemplo ensina uma capacidade importante do jogo.
`quality_score`: naturalidade + coerência + fidelidade ao personagem + correção factual.
`novelty_score`: quão diferente é de exemplos já armazenados.

Regra inicial: manter para treino quando `importance >= 60`, `quality >= 70` e `novelty >= 35`, ou quando for um erro importante com correção útil.

## Tipos de treino
- SFT: pergunta/contexto -> resposta boa.
- Preference/DPO: resposta ruim vs resposta preferida.
- Classification: fato/rumor/blefe/contradição/relevância.
- Memory selection: o que guardar, resumir, esquecer.
- Tool/action policy: quando chamar perícia, câmera, banco, timeline etc.

## Memória imediata não é treinamento
`ai_memory_items` melhora o comportamento agora via recuperação de contexto. Isso é separado do treinamento dos pesos. Memórias possuem escopo, importância, confiança, uso e possível expiração.

## Promoção segura de modelos
Nunca substituir Gemini apenas porque o student foi treinado. Exigir suíte de avaliação congelada, testes de regressão, factualidade contra Bíblia do Caso, consistência temporal, voz dos NPCs, resistência a blefes e taxa mínima de vitória.

Exemplo de estágios:
- 0: 100% Gemini.
- 1: Student em shadow mode; usuário ainda recebe Gemini.
- 2: Student responde 10%; Gemini audita.
- 3: 50/50 com fallback.
- 4: Student principal; Gemini apenas casos difíceis/auditoria.
- 5: Student independente, se avaliações mostrarem qualidade suficiente.

## Privacidade e dados
Nunca gravar API keys, tokens ou segredos técnicos no corpus. Para dados de jogadores reais, usar consentimento/configuração apropriada antes de transformar conteúdo em dataset persistente. O corpus deve poder excluir dados por sala/jogador e exportar somente campos necessários ao treino.
