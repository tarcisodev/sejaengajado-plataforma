# F0.3 — Swap e rotação de logs

Quem executa: Tarciso ou Atlas, com OK explícito. O Cursor não cria swap, não edita o Docker e não reinicia a VPS.

Objetivo: um pico de deploy não chamar o OOM killer, e os logs do Docker não encherem o disco. A linha de base de 03/10 tinha ~7,5 GB em logs sem rotação. Confirme o tamanho no F0.1 antes de apagar qualquer coisa.

O swap não substitui a folga de RAM do F0.2.

## 1. Swap de 4 GB

Confira espaço livre. Pare se `/` tiver menos de 6 GB livres.

```bash
df -h /
swapon --show
free -m
```

Se já existir um swap de 4 GB ou mais, não crie outro. Anote o que `swapon --show` listou e siga para a rotação.

```bash
fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

`swapon --show` precisa listar `/swapfile` com 4G. `chmod 600` vem antes de `mkswap`.

Persistir o uso baixo de swap:

```bash
printf 'vm.swappiness=10\n' > /etc/sysctl.d/99-swap.conf
sysctl --system
```

`sysctl vm.swappiness` precisa imprimir `10`.

Persistir o arquivo no boot. Uma linha só, sem duplicar:

```bash
grep -q '^/swapfile ' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
```

## 2. Rotação de logs do Docker

O padrão novo vale para container criado depois da mudança. Os json atuais continuam no disco até serem truncados, e o daemon só lê `daemon.json` na subida.

Copie o arquivo atual para fora do git, no próprio host:

```bash
cp -a /etc/docker/daemon.json /root/daemon.json.bak-$(date +%F) 2>/dev/null || true
```

Se o arquivo não existir, crie este conteúdo:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Se já existir, acrescente só `log-driver` e `log-opts`. Não apague as outras chaves. Valide antes de reiniciar:

```bash
python3 -m json.tool /etc/docker/daemon.json >/dev/null
```

JSON inválido impede o Docker de subir.

Meça e esvazie os logs abertos, sem remover o diretório do container:

```bash
du -sh /var/lib/docker/containers
find /var/lib/docker/containers -name '*-json.log' -exec truncate -s 0 {} \;
du -sh /var/lib/docker/containers
```

Reiniciar o daemon derruba todos os stacks por alguns segundos. Faça numa janela, com a segunda sessão SSH aberta.

```bash
systemctl restart docker
docker service ls
```

Espere as réplicas voltarem ao que eram. Para um serviço que ainda mostre o driver antigo:

```bash
docker service update --force <servico>
```

Um serviço por vez. Traefik por último: ele é a porta de entrada dos outros sites. Confira o domínio desse serviço antes de passar ao próximo.

```bash
docker inspect $(docker ps -q --filter name=<servico> | head -1) --format '{{.HostConfig.LogConfig.Type}} {{json .HostConfig.LogConfig.Config}}'
```

O esperado é `json-file` com `max-size` `10m` e `max-file` `3`.

## 3. Reboot de prova

Só depois do swap no `fstab` e do `daemon.json` válido. Janela marcada. Avise que todos os sites caem durante o boot.

Depois que a máquina voltar:

```bash
swapon --show
sysctl vm.swappiness
free -m
df -h /
docker service ls
python3 -m json.tool /etc/docker/daemon.json >/dev/null
```

`swapon --show` lista 4G, `vm.swappiness` é 10, as réplicas voltaram e o disco está menor do que antes do `truncate`.

Na sua máquina, repita o curl dos domínios que precisam continuar no ar (os mesmos do F0.2).

## Evidência

| Campo | Valor | Data |
|---|---|---|
| `swapon --show` depois do reboot | | |
| `vm.swappiness` | | |
| Tamanho de `/var/lib/docker/containers` antes | | |
| Tamanho depois | | |
| `df -h /` depois | | |
| Réplicas após o reboot | | |
| Domínios testados e código HTTP | | |
