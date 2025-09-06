import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatosModule } from './datos/datos.module';
import { AutenticadorModule } from './autenticador/autenticador.module';
import { UsuarioModule } from './usuario/usuario.module';
import { MongooseModule } from '@nestjs/mongoose';
import { PruebasModule } from './pruebas/pruebas.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb+srv://biocafe2025:BioCafe2025@cluster0.xww0m.mongodb.net/biocafe',
      }),
      inject: [ConfigService],
    }),
    DatosModule, AutenticadorModule, UsuarioModule, PruebasModule, EmailModule],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}
