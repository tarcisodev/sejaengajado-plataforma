# F0.4 — Hardening (SSH, firewall, Portainer)

Quem executa: Tarciso ou Atlas, com OK explícito. O Cursor não altera SSH, firewall, Traefik nem Portainer.

Objetivo: login por senha recusado, Swarm e Portainer invisíveis de fora, Traefik em `INFO`. Use `<VPS_IP>` e `<IP_ADMIN>`. Não grave IP nem chave neste repositório.

Mantenha a sessão SSH atual aberta até a sessão nova entrar com chave. Se a nova falhar, desfaça o drop-in pela sessão antiga.

## 1. SSH só por chave

Na sua máquina, antes de mudar o servidor:

```bash
ssh -i <caminho-da-chave> <usuario>@<VPS_IP>
```

Essa segunda sessão precisa abrir. Sem isso, pare.

No servidor, um drop-in em vez de reescrever o `sshd_config` inteiro:

```bash
cp -a /etc/ssh/sshd_config /root/sshd_config.bak-$(date +%F)
cat > /etc/ssh/sshd_config.d/99-chave.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
EOF
sshd -t
systemctl reload ssh
```

`sshd -t` sem saída é configuração válida. Se o serviço se chama `sshd` e não `ssh`, use `systemctl reload sshd`.

Pela sessão nova, ainda aberta, confira:

```bash
sshd -T | grep -E "permitrootlogin|passwordauthentication"
```

O esperado é `permitrootlogin prohibit-password` e `passwordauthentication no`.

Da sua máquina, a senha tem de ser recusada:

```bash
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no <usuario>@<VPS_IP>
```

Se você não quiser root, crie um usuário com sudo e chave **antes** deste drop-in e use esse usuário na segunda sessão. Não feche o root até esse usuário entrar.

fail2ban, com a jail do SSH:

```bash
apt-get update && apt-get install -y fail2ban
printf '[sshd]\nenabled = true\n' > /etc/fail2ban/jail.d/sshd.local
systemctl enable --now fail2ban
fail2ban-client status sshd
```

## 2. Firewall

O Docker publica porta por iptables e ignora o ufw. O caminho preferido é o firewall do painel da Hostinger. `DOCKER-USER` só se o painel não cobrir o que o Docker publicou.

Liberar:

- 22, de preferência só a partir de `<IP_ADMIN>`
- 80
- 443

Fechar, inclusive se algum serviço as publicou:

- 2377, 7946 e 4789 (Swarm)
- 9000 e 9443 (Portainer)
- o restante

Não feche a 22 do `<IP_ADMIN>` antes de provar o SSH por chave. Uma regra errada derruba o acesso.

Se usar `DOCKER-USER`, grave as regras num arquivo fora do git e torne-as persistentes (pacote de persistência do Ubuntu). Inclua o tráfego `ESTABLISHED,RELATED`. Teste 80 e 443 de fora antes de encerrar a sessão.

## 3. Portainer sem router público

Descubra como ele está exposto. Não cole labels com segredo no git.

```bash
docker service ls --format "{{.Name}}" | grep -i portainer
docker service inspect <servico-portainer> --format "{{json .Endpoint.Ports}} {{json .Spec.Labels}}"
```

Remova o router Traefik público e a porta publicada (9000/9443). Faça isso no compose de origem desse stack e rode o deploy desse stack. Não apague o volume do Portainer.

Acesso por túnel, da sua máquina:

```bash
ssh -i <caminho-da-chave> -L 9443:127.0.0.1:9443 <usuario>@<VPS_IP>
```

Abra `https://127.0.0.1:9443` na sua máquina. Tailscale no lugar do túnel também serve, desde que a porta não fique na internet.

De fora, os dois comandos falham (timeout ou recusa):

```bash
nc -zv -w 5 <VPS_IP> 2377
nc -zv -w 5 <VPS_IP> 9443
```

## 4. Traefik em INFO

Edite o compose que já define o serviço `traefik`. Troque `--log.level=DEBUG` por `--log.level=INFO`. Não reescreva a lista de argumentos à mão com `docker service update`: isso derruba o certresolver atual.

Antes do deploy:

```bash
docker service inspect traefik > /root/traefik-spec-$(date +%F).json
```

Deploy só do stack do Traefik. Se os outros sites caírem:

```bash
docker service rollback traefik
```

Confira o nível nos args do serviço, sem colar o JSON inteiro no git.

## 5. Varredura externa

De outra máquina, não da VPS:

```bash
nmap -Pn -p 22,80,443,2377,7946,4789,9000,9443 <VPS_IP>
```

O esperado: 22, 80 e 443 abertas (22 só no `<IP_ADMIN>`, se a regra for por IP). 2377, 7946, 4789, 9000 e 9443 fechadas ou filtradas. Os sites que já estavam no ar continuam respondendo em 80/443.

## Evidência

| Campo | Valor | Data |
|---|---|---|
| Login por senha | recusado | |
| `permitrootlogin` / `passwordauthentication` | | |
| `nc` 2377 de fora | | |
| `nc` 9443 de fora | | |
| Portainer pelo túnel | abre / não abre | |
| `--log.level` do Traefik | | |
| Portas do nmap | | |
