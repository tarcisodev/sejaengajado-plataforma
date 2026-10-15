import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { Audit } from '../../audit/audit.interceptor';
import { Roles } from '../../auth/roles.decorator';
import { ProductsService } from './products.service';

@Controller('admin/products')
@Roles('ADMIN')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.get(id);
  }

  @Patch(':id')
  @Audit({
    action: 'product.update',
    entity: 'Product',
    entityId: (_r, req) => req.params.id,
  })
  patch(@Param('id') id: string, @Body() body: unknown) {
    return this.products.patch(id, body);
  }
}
