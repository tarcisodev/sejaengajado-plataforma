# F0.2 — Folga de RAM (⏳P21)

Quem executa: Tarciso ou Atlas, com OK explícito em cada stack que for a zero. O Cursor não escala serviço nem compra plano.

Placeholder ⏳P21: primeiro liberar stacks ociosos. Se `MemAvailable` continuar abaixo de 1,2 GB, subir para o KVM 4 (16 GB).

## Por que

O stack `sejaengajado` reserva cerca de 460 MB e limita cerca de 1,4 GB. No deploy com start-first há um pico extra (cópia temporária de web e api, na ordem de 0,5 GB). A linha de base de 03/10 tinha ~390 MB livres e nenhum swap. Isso não foi revalidado: use o número do F0.1.

Meta antes de subir o stack: `MemAvailable` ≥ 1200 MB em `free -m`.

Não use swap no lugar dessa folga. O swap de 4 GB é o bloco F0.3.

## 1. Medir de novo

Na VPS, só leitura:

```bash
free -m
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}" | sort -k2 -h
docker stack ls
docker service ls --format "{{.Name}} {{.Replicas}}"
```

Anote `MemAvailable` na tabela do fim. Se já for ≥ 1200, pare aqui e registre a evidência. Não escale nada.

## 2. Escolher o que pode ir a zero

A lista de stacks ociosos é decisão do Tarciso. Não há inventário confirmado neste repositório. Preencha a tabela antes de qualquer `scale`.

Não mexer, salvo OK separado:

- Traefik
- Portainer, enquanto ainda for o caminho de acesso
- o stack que serve os sites que precisam continuar no ar
- bancos cujo volume não foi conferido

Para cada candidato, anote o domínio público que deve seguir respondendo e o comando de volta (`scale` para a réplica anterior).

| Stack | Serviço | Réplicas hoje | Ação | Domínio que precisa continuar | Volta |
|---|---|---|---|---|---|
| | | | manter / zerar | | `docker service scale <servico>=<n>` |

## 3. Escalar só o que estiver marcado como zerar

Um serviço por vez. Confirme o nome com `docker service ls` antes.

```bash
docker service scale <stack>_<servico>=0
```

Espere o serviço ficar `0/0`. Rode `free -m` de novo. Repita só enquanto a meta não foi atingida e ainda houver linha marcada como zerar.

Para repor:

```bash
docker service scale <stack>_<servico>=<replicas-anteriores>
```

## 4. Os outros sites continuam no ar

Antes e depois de cada `scale`, na sua máquina (não na VPS):

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://<dominio-que-deve-continuar>
```

Código 2xx ou o redirect esperado. Se um domínio que deveria ficar no ar falhar, volte a réplica na hora e pare.

## 5. Se ainda ficar abaixo de 1,2 GB: KVM 4

Não force mais stacks a zero para “chegar no número”.

1. Anote `free -m` e a lista do que já foi a zero.
2. No painel da Hostinger, no VPS atual (KVM 2), faça snapshot se o painel oferecer.
3. Upgrade para o KVM 4 (16 GB). Há janela de reinício.
4. Depois que a máquina voltar, confira SSH, `free -m` e `docker service ls` (réplicas iguais às de antes do upgrade, mais as que você zerou de propósito).
5. Repita o curl dos domínios da tabela.

## Evidência

O bloco só fecha com esta tabela preenchida.

| Campo | Valor | Data |
|---|---|---|
| `MemAvailable` antes | | |
| Stacks/serviços zerados | | |
| `MemAvailable` depois | | |
| ≥ 1200 MB | sim / não | |
| Caminho usado | limpeza / KVM 4 | |
| Domínios testados e código HTTP | | |
