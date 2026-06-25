-- AlterTable
ALTER TABLE "libros" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "eliminada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "notas" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "eliminada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "notificaciones" ADD COLUMN     "ultimaEnviada" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificacionCodigo" TEXT,
ADD COLUMN     "verificacionExpira" TIMESTAMP(3);
