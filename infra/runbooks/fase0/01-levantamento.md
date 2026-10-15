# F0.1 — Levantamento read-only da VPS

Quem executa: Tarciso ou Atlas, com OK explícito. Este arquivo não é aplicado pelo Cursor. Nenhum comando abaixo altera estado.

Não grave IP, token, e-mail nem senha neste repositório. Use `<VPS_IP>` e o nome da chave SSH local.

## Linha de base conhecida (não revalidada)

Fonte: levantamento de 03/10/2026, marcado como não verificado em 15/10/2026. Não usar estes números como estado atual.

| Item | Valor de 03/10 | Conferido em |
|---|---|---|
| Plano | Hostinger KVM 2, 2 vCPU, 7,8 GiB | |
| RAM livre | ~390 MiB, sem swap | |
| Disco | ~33 GB livres; logs Docker sem rotação (~7,5 GB) | |
| Swarm | 1 nó, cerca de 16 stacks / 41 serviços | |
| Traefik | v3.5.3, log DEBUG, rede `TarcisoDevNet`; resolver atual não confirmado | |
| Acesso | SSH com senha e root, sem firewall | |
| Portas | 2377, 7946 e 4789 abertas; Portainer público | |
| Backup de banco | nenhum | |

## Como rodar

Substitua `<VPS_IP>` e o caminho da chave. Mantenha uma segunda sessão SSH aberta. Copie a saída para a tabela de execução no fim deste arquivo, com a data.

```bash
ssh -i <caminho-da-chave> <usuario>@<VPS_IP> 'bash -s' <<'EOF'
set -u
echo "=== memoria ==="
free -m
echo "=== swap ==="
swapon --show
echo "=== disco ==="
df -h / /var/lib/docker
echo "=== uptime ==="
uptime
echo "=== stacks ==="
docker stack ls
echo "=== servicos ==="
docker service ls --format "{{.Name}} {{.Replicas}} {{.Image}}"
echo "=== memoria dos containers ==="
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}" | sort -k2 -h | tail -20
echo "=== logs docker ==="
du -sh /var/lib/docker/containers
echo "=== daemon.json ==="
cat /etc/docker/daemon.json 2>/dev/null || echo "(sem /etc/docker/daemon.json)"
echo "=== traefik args ==="
docker service inspect $(docker service ls -q -f name=traefik) --format "{{json .Spec.TaskTemplate.ContainerSpec.Args}}"
echo "=== traefik secrets e env (so nomes) ==="
docker service inspect $(docker service ls -q -f name=traefik) --format "{{json .Spec.TaskTemplate.ContainerSpec.Secrets}}"
echo "=== rede swarm ==="
docker network inspect TarcisoDevNet --format "{{.Driver}} {{.Attachable}}"
echo "=== firewall ==="
ufw status
echo "=== portas ==="
ss -tlnp | grep -E ":(22|80|443|2377|7946|4789|9000|9443)" || true
echo "=== sshd ==="
sshd -T | grep -E "permitrootlogin|passwordauthentication"
EOF
```

Da saída do Traefik, anote só:

- a versão da imagem (`docker service ls`)
- o nome do certresolver já em uso (argumentos `certificatesresolvers.<nome>.acme`)
- o nível de log (`--log.level`)

Não cole o JSON completo de secrets nem variáveis de ambiente no git. Se a saída listar valores, guarde fora do repositório.

## Tabela de execução

Preencher depois de rodar. Enquanto a data estiver vazia, o F0.1 não está pronto.

| Campo | Valor | Data |
|---|---|---|
| MemAvailable (`free -m`) | | |
| Swap | | |
| Disco livre em `/` | | |
| Disco livre em `/var/lib/docker` | | |
| Tamanho de `/var/lib/docker/containers` | | |
| Quantidade de stacks | | |
| Imagem e versão do Traefik | | |
| Certresolver atual | | |
| `--log.level` do Traefik | | |
| Driver da rede `TarcisoDevNet` | | |
| `ufw status` | | |
| Portas em escuta (22, 80, 443, 2377, 7946, 4789, 9000, 9443) | | |
| `permitrootlogin` | | |
| `passwordauthentication` | | |

## Revisão

- Os comandos são leitura: `free`, `swapon --show`, `df`, `docker stack ls`, `docker service ls`, `docker stats --no-stream`, `du`, `cat`, `docker service inspect`, `docker network inspect`, `ufw status`, `ss`, `sshd -T`.
- Não há `docker service update`, `ufw`, escrita em `/etc` nem troca de DNS.
