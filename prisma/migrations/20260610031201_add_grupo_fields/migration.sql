/*
  Warnings:

  - A unique constraint covering the columns `[grupoId]` on the table `materias` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "materias" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "eliminada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "esGrupo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "grupoId" TEXT,
ADD COLUMN     "propietarioId" INTEGER;

-- CreateTable
CREATE TABLE "miembros_grupo" (
    "id" SERIAL NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "aceptado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "miembros_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materias_grupoId_key" ON "materias"("grupoId");

-- AddForeignKey
ALTER TABLE "miembros_grupo" ADD CONSTRAINT "miembros_grupo_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "materias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
