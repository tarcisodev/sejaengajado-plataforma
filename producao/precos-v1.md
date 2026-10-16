> **RASCUNHO, revisar com advogado antes de publicar** (cláusulas comerciais; os valores abaixo já estão decididos).

# Seja Engajado — Tabela oficial de preços v1

Vigência: a partir do go-live. Moeda: BRL. Valores no seed sempre em **centavos inteiros**.

**O preço ao cliente é apenas sugerido.** O revendedor é livre para cobrar o valor que quiser; a plataforma cobra dele apenas o atacado.

## 1. Tabela

| Produto | Código (seed) | Preço sugerido ao cliente | Atacado (revendedor paga) | Margem sugerida do revendedor | Observações |
|---|---|---|---|---|---|
| Plano Pronto (site único + 1 placa de brinde) | `SITE_ONE_TIME` | R$ 299,00 | R$ 149,00 | R$ 150,00 (~50%) | 1º ano de hospedagem incluso; cliente não edita |
| Renovação anual do Pronto | `RENEWAL` | R$ 129,00/ano | R$ 59,00/ano | R$ 70,00 (~54%) | A partir do 2º ano |
| Plano Mensal (edição + 1 placa de brinde) | `SITE_PRO` | R$ 49,00/mês | R$ 24,90/mês | R$ 24,10/mês (~49%) | Fidelidade 12 meses; multa por cancelamento antecipado = R$ 79,00 |
| Placa avulsa / extra (QR ou NFC) | `PLAQUE_QR` / `PLAQUE_NFC` | R$ 79,00 | R$ 25,00 | R$ 54,00 (~68%) | Custo de produção estimado R$ 10,00 |

### Programas para revendedores

| Programa | Regra | Benefício |
|---|---|---|
| Fundador | 3 primeiros revendedores | Mensalidade de revendedor R$ 0; atacado congelado por 12 meses; 3 placas de demonstração grátis |
| Bônus de volume | A partir de 10 sites ativos | 10% de desconto no atacado (enquanto mantiver ≥ 10 sites ativos) |

> Premissa adotada: o bônus de 10% incide sobre o atacado vigente, inclusive o congelado do Fundador. Confirmar no admin.

### Prazos de inadimplência (mantidos)

| Quem | Prazo | Efeito |
|---|---|---|
| Cliente | 1 a 7 dias de atraso | Aviso |
| Cliente | 8 a 15 dias | Site somente leitura (sem edição) |
| Cliente | a partir de 16 dias | Site suspenso |
| Cliente | 60 dias | Site arquivado |
| Revendedor | 30 dias | Carência; depois, suspensão da conta e os clientes podem migrar para a plataforma |

## 2. Conta por venda

Custo de produção da placa: R$ 10,00 (banca a plataforma, inclusive a de brinde).

| Venda | Cliente paga (sugerido) | Revendedor ganha | Plataforma recebe | Plataforma lucra (− placa) |
|---|---|---|---|---|
| Pronto | 299,00 | 299 − 149 = **150,00** | 149,00 | 149 − 10 = **≈ 139,00** |
| Renovação Pronto | 129,00 | 129 − 59 = **70,00** | 59,00 | **59,00** |
| Mensal (por mês) | 49,00 | 49 − 24,90 = **24,10** | 24,90 | 24,90 (1º mês: 24,90 − 10 = 14,90) |
| Mensal (12 meses) | 588,00 | **289,20** | 298,80 | 298,80 − 10 = **288,80** |
| Placa extra | 79,00 | 79 − 25 = **54,00** | 25,00 | 25 − 10 = **15,00** |

Lucro da plataforma = bruto, antes de taxas Asaas, impostos (DAS/Simples) e infraestrutura.

## 3. Projeção: 3 revendedores × 10 sites/mês (só Pronto, preço sugerido)

Por mês: 30 sites.

| Item | Por revendedor/mês | Total (3)/mês | 12 meses (total) |
|---|---|---|---|
| Faturamento do revendedor (10 × 299) | R$ 2.990 | R$ 8.970 | R$ 107.640 |
| Lucro do revendedor (10 × 150) | R$ 1.500 | R$ 4.500 | R$ 54.000 |
| Receita da plataforma (10 × 149) | R$ 1.490 | R$ 4.470 | R$ 53.640 |
| Custo de placas (10 × 10) | R$ 100 | R$ 300 | R$ 3.600 |
| **Lucro bruto da plataforma (10 × 139)** | **R$ 1.390** | **R$ 4.170** | **R$ 50.040** |

Observações:
- Cenário conservador sem o bônus. Com ≥ 10 sites ativos (a partir do 2º mês), o atacado do Pronto cai para R$ 134,10: lucro da plataforma ≈ R$ 124,10/site (R$ 3.723/mês para 30 sites) e o revendedor passa a ganhar R$ 164,90/site.
- Fundadores: mensalidade de revendedor R$ 0 e 3 placas demo (custo R$ 30 por fundador, R$ 90 no total, uma vez).
- Renovações (R$ 59/site/ano para a plataforma) começam no 13º mês: 360 sites × R$ 59 = R$ 21.240/ano de receita recorrente adicional, se todos renovarem.

## 4. Valores para o seed (centavos)

```ini
# Produtos — atacado base (baseWholesaleCents)
SITE_ONE_TIME.baseWholesaleCents=14900
SITE_ONE_TIME.suggestedPriceCents=29900
SITE_ONE_TIME.includedHostingMonths=12
SITE_ONE_TIME.giftPlaques=1

RENEWAL.baseWholesaleCents=5900
RENEWAL.suggestedPriceCents=12900
RENEWAL.intervalMonths=12

SITE_PRO.baseWholesaleCents=2490
SITE_PRO.suggestedPriceCents=4900
SITE_PRO.intervalMonths=1
SITE_PRO.commitmentMonths=12
SITE_PRO.earlyCancelPenaltyCents=7900
SITE_PRO.giftPlaques=1

PLAQUE_QR.baseWholesaleCents=2500
PLAQUE_QR.suggestedPriceCents=7900
PLAQUE_QR.productionCostCents=1000
PLAQUE_NFC.baseWholesaleCents=2500
PLAQUE_NFC.suggestedPriceCents=7900
PLAQUE_NFC.productionCostCents=1000

# Programas
founder.maxResellers=3
founder.resellerMonthlyFeeCents=0
founder.wholesaleFreezeMonths=12
founder.demoPlaques=3
volumeBonus.minActiveSites=10
volumeBonus.discountPercent=10

# PlatformConfig — inadimplência (dias)
client.warnFromDay=1
client.warnToDay=7
client.readOnlyFromDay=8
client.readOnlyToDay=15
client.suspendFromDay=16
client.archiveDay=60
resellerGraceDays=30
plaquePenaltyCents=7900
```
