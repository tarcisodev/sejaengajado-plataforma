# F0.6 — Certresolver `cfdns` no staging do Let's Encrypt (⏳P22)

Quem executa: Tarciso ou Atlas, com OK explícito, na janela marcada. O Cursor não faz deploy e não mexe no Traefik.

Placeholder ⏳P22: domingo, 01:00–03:00 (BRT). A data é do Tarciso. Fora dessa janela, pare.

Objetivo: provar o wildcard DNS-01 com a CA de **staging**, sem trocar o certresolver dos sites que já estão no ar. A ida para a CA de produção fica no PRODUCAO-06 B5.

Depende do F0.5: `docker secret ls` mostra `cf_dns_api_token_v1`, e `teste.sejaengajado.com.br` já resolve no `<VPS_IP>`.

O trecho a acrescentar está em `infra/traefik/cfdns-staging.patch.yml`. Ele não é um stack. Cole as linhas no compose que já define o Traefik. Não rode `docker stack deploy -c` nesse arquivo.

## 1. Antes de alterar

Confirme no F0.1 o nome do certresolver atual e o provider (`swarm` ou `docker`). Não renomeie esse resolver. Se o provider não for swarm, troque a label `traefik.swarm.network` pela equivalente antes de colar.

Substitua `<ACME_EMAIL>` e `<TRAEFIK_NETWORK>` no compose de origem. Não commite o e-mail real se ele não for público.

Backup, no host, fora do git:

```bash
docker service inspect traefik > /root/traefik-spec-$(date +%F).json
```

O `acme.json` está no volume do Traefik. Copie para `/root/acme.json.bak-$(date +%F)` pelo caminho montado nesse serviço. Não apague o original.

Liste os domínios dos outros stacks e anote o HTTP de cada um **antes**:

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://<dominio>
```

| Domínio | HTTP antes | HTTP depois |
|---|---|---|
| | | |

## 2. Acrescentar e publicar

No compose de origem do Traefik:

- mantenha os args atuais
- acrescente os args `certificatesresolvers.cfdns.acme.*` do patch, com `caserver` de staging e storage `/letsencrypt/acme-cf.json`
- acrescente `CF_DNS_API_TOKEN_FILE=/run/secrets/cf_dns_api_token`
- declare o secret externo `cf_dns_api_token_v1` com target `cf_dns_api_token`
- acrescente só o router `se-cfdns-probe` para `teste.sejaengajado.com.br`

O serviço `se-cfdns-probe` precisa existir na mesma rede, na porta 80. Um whoami temporário basta. Não aponte o router de prova para o site de outro stack.

Deploy só do stack do Traefik, na janela. O proxy de todos os sites reinicia por alguns segundos.

Se algum domínio da tabela cair e não voltar:

```bash
docker service rollback traefik
```

## 3. Prova

```bash
docker service logs traefik 2>&1 | grep -i cfdns
curl -vk https://teste.sejaengajado.com.br 2>&1 | grep -Ei "issuer|subject alternative|DNS:"
```

O esperado no `curl`: issuer com `(STAGING)` e SAN `*.sejaengajado.com.br`. Um 404 do whoami não invalida a prova; o que importa é o certificado.

Repita o curl da tabela. Todos os domínios de antes precisam responder de novo.

Não apague a linha `caserver` de staging neste bloco. Não apague `acme-cf.json` para "forçar" a CA de produção.

## Evidência

| Campo | Valor | Data |
|---|---|---|
| Janela (data, 01:00–03:00 BRT) | | |
| Certresolver antigo, intacto | | |
| Issuer de `teste.` | | |
| SAN | | |
| Domínios dos outros stacks após o deploy | | |
| Rollback usado | sim / não | |
