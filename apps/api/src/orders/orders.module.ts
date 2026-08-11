import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  // For the two guards on the controller — `AuthModule` exports them along with
  // the `JwtModule` they verify tokens with.
  imports: [AuthModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
