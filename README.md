# Plantão Fácil

App pessoal (PWA) de apoio ao plantão médico: biblioteca de prescrições, dose por peso e calculadoras — tudo offline e apenas no aparelho.

Regras do projeto, decisões e comandos: veja [CLAUDE.md](CLAUDE.md).

```bash
npm install
npm run dev
```

## Modo pen drive (PCs com restrição)

```bash
npm run build:pendrive
```

Copie `dist-pendrive/plantao-facil.html` e um backup `.json` (exportado em Backup) para o pen drive.
No PC, abra o `.html` no navegador e escolha o backup. Somente leitura.
