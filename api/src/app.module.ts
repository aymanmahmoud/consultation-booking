import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConsultantsModule } from './consultants/consultants.module';
import { PrismaModule } from './prisma/prisma.module';
import { SpecialtiesModule } from './specialties/specialties.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SpecialtiesModule,
    ConsultantsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
