import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar CORS para permitir comunicación con el frontend
  app.enableCors({
    origin: [
      'http://localhost:3000', 
      'http://localhost:3001',
      'https://biocafe.onrender.com', // Frontend en Render
      /^https?:\/\/.*\.netlify\.app$/,
      /^https?:\/\/.*\.vercel\.app$/
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
  // Usar el puerto que proporciona Render o 3001 por defecto
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend servidor ejecutándose en puerto ${port}`);
}
bootstrap();
