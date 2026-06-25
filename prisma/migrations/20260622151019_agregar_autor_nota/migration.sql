-- AlterTable
ALTER TABLE "notas" ADD COLUMN     "autorId" INTEGER;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
