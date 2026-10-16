# Traefik `forwardedHeaders` + Cloudflare (SEC-GOLIVE)

A API usa `trust proxy = 1` (um hop: Traefik) e rate-limit / webhooks leem
**`CF-Connecting-IP`**, nunca o primeiro `X-Forwarded-For` (forjável pelo cliente).

No Traefik (entrypoints `websecure`), confie só nos IPs da Cloudflare ao
repassar headers:

```yaml
# Exemplo — entrypoint / router do se-app
entryPoints:
  websecure:
    forwardedHeaders:
      trustedIPs:
        # https://www.cloudflare.com/ips/ — manter atualizado
        - "173.245.48.0/20"
        - "103.21.244.0/22"
        - "103.22.200.0/22"
        - "103.31.4.0/22"
        - "141.101.64.0/18"
        - "108.162.192.0/18"
        - "190.93.240.0/20"
        - "188.114.96.0/20"
        - "197.234.240.0/22"
        - "198.41.128.0/17"
        - "162.158.0.0/15"
        - "104.16.0.0/13"
        - "104.24.0.0/14"
        - "172.64.0.0/13"
        - "131.0.72.0/22"
        # IPv6 (resumo; completar pela lista oficial)
        - "2400:cb00::/32"
        - "2606:4700::/32"
        - "2803:f800::/32"
        - "2405:b500::/32"
        - "2405:8100::/32"
        - "2a06:98c0::/29"
        - "2c0f:f248::/32"
```

Sem `trustedIPs`, um cliente poderia spoofar `X-Forwarded-For` e burlar throttle.
Com Cloudflare na frente, `CF-Connecting-IP` é a fonte preferida na Nest.
