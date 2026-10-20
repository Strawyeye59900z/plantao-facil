# Decisões — anamnese por voz e hospedagem (20/10/2026)

1. **Hospedagem:** o app inteiro (PWA + API) roda no servidor próprio (Proxmox LXC, Cloudflare Tunnel). O GitHub Pages deixa de ser o alvo da v2.
2. **Privacidade antes da API:** o texto captado pelo celular passa por remoção de **nome do paciente** antes de ser enviado. Como regex não identifica nomes com segurança, a remoção é feita pelo usuário numa etapa de revisão do texto bruto (não automática). Demais identificadores (CPF, RG, CNS, telefone, e-mail, CEP, data de nascimento) são removidos por regra.
3. **Fontes:** embutidas no projeto (sem recursos externos em tempo de execução).
4. **Estrutura:** seguir o padrão atual do repositório (`src/dominio`, `src/components`, `src/views`).
5. **Importação por IA (PDF):** mantida como está hoje até a Fase 4 do plano de importação.
6. **Plano de anamnese:** `plano-transcricao-anamnese.md` (Downloads), com as fases 1 a 8 conforme o plano.
