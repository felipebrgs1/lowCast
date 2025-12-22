# Guia de Contribuição

Obrigado por querer contribuir com o **lowCast**! Este guia resume o fluxo recomendado para colaborar de forma rápida e segura.

## Antes de começar
- Leia o [README](README.md) para entender a proposta e a arquitetura.
- Siga o [Código de Conduta](CODE_OF_CONDUCT.md) e o guia de [Segurança](SECURITY.md).
- Instale os pré-requisitos do Tauri descritos na documentação oficial: [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/).
- Tenha o **Bun** instalado (gerenciamento de pacotes e scripts).

## Configurando o ambiente
1. Instale as dependências:
   ```bash
   bun install
   ```
2. Rode em modo desenvolvimento:
   ```bash
   bun run tauri dev
   ```

## Padrões de código e qualidade
- Utilize o Biome para garantir estilo e formatação:
  ```bash
  bun run lint
  ```
- Prefira mudanças pequenas e focadas. Evite commits com alterações não relacionadas.
- Adicione ou atualize testes quando alterar comportamento. Para mudanças apenas de documentação, não há testes obrigatórios.

## Fluxo para abrir PRs
1. Abra uma *issue* descrevendo a motivação (bug ou feature), quando possível.
2. Crie uma branch a partir da `main`.
3. Mantenha o README/CONTRIBUTING atualizados se o fluxo ou comandos mudarem.
4. Antes de abrir a PR:
   - Garanta que o app inicia (`bun run tauri dev`) quando aplicável.
   - Execute o lint (`bun run lint`).
   - Preencha a descrição da PR com um resumo das mudanças e como validar.

## Reportando vulnerabilidades
Para questões de segurança, siga as instruções do [SECURITY.md](SECURITY.md) e evite abrir *issues* públicas.
