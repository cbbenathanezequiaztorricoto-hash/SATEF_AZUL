-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema satef_azul
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema satef_azul
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `satef_azul` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci ;
USE `satef_azul` ;

-- -----------------------------------------------------
-- Table `satef_azul`.`usuario`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `satef_azul`.`usuario` (
  `idUsuario` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `ultimoLogin` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`idUsuario`),
  UNIQUE INDEX `username` (`username` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 5
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `satef_azul`.`administrador`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `satef_azul`.`administrador` (
  `idAdministrador` INT NOT NULL AUTO_INCREMENT,
  `idUsuario` INT NULL DEFAULT NULL,
  `primerNombreAdmin` VARCHAR(50) NULL DEFAULT NULL,
  `segundoNombreAdmin` VARCHAR(50) NULL DEFAULT NULL,
  `apellidoPaternoAdmin` VARCHAR(50) NULL DEFAULT NULL,
  `apellidoMaternoAdmin` VARCHAR(50) NULL DEFAULT NULL,
  `ci` VARCHAR(20) NULL DEFAULT NULL,
  `telf` VARCHAR(20) NULL DEFAULT NULL,
  PRIMARY KEY (`idAdministrador`),
  UNIQUE INDEX `idUsuario` (`idUsuario` ASC) VISIBLE,
  CONSTRAINT `administrador_ibfk_1`
    FOREIGN KEY (`idUsuario`)
    REFERENCES `satef_azul`.`usuario` (`idUsuario`)
    ON DELETE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 2
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `satef_azul`.`conductor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `satef_azul`.`conductor` (
  `idConductor` INT NOT NULL AUTO_INCREMENT,
  `idUsuario` INT NULL DEFAULT NULL,
  `primerNombreConductor` VARCHAR(50) NULL DEFAULT NULL,
  `segundoNombreConductor` VARCHAR(50) NULL DEFAULT NULL,
  `apellidoPaterno` VARCHAR(50) NULL DEFAULT NULL,
  `apellidoMaterno` VARCHAR(50) NULL DEFAULT NULL,
  `ci` VARCHAR(20) NULL DEFAULT NULL,
  `telf` VARCHAR(20) NULL DEFAULT NULL,
  `categoriaLicenciaConducir` CHAR(5) NULL DEFAULT NULL,
  PRIMARY KEY (`idConductor`),
  UNIQUE INDEX `idUsuario` (`idUsuario` ASC) VISIBLE,
  CONSTRAINT `conductor_ibfk_1`
    FOREIGN KEY (`idUsuario`)
    REFERENCES `satef_azul`.`usuario` (`idUsuario`)
    ON DELETE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `satef_azul`.`antecedente`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `satef_azul`.`antecedente` (
  `idAntecedente` INT NOT NULL AUTO_INCREMENT,
  `idConductor` INT NULL DEFAULT NULL,
  `razonAntecedente` TEXT NULL DEFAULT NULL,
  `fechaAntecedente` DATE NULL DEFAULT NULL,
  PRIMARY KEY (`idAntecedente`),
  INDEX `idConductor` (`idConductor` ASC) VISIBLE,
  CONSTRAINT `antecedente_ibfk_1`
    FOREIGN KEY (`idConductor`)
    REFERENCES `satef_azul`.`conductor` (`idConductor`)
    ON DELETE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `satef_azul`.`bus`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `satef_azul`.`bus` (
  `idBus` INT NOT NULL AUTO_INCREMENT,
  `placa` VARCHAR(20) NOT NULL,
  `marca` VARCHAR(50) NULL DEFAULT NULL,
  `modelo` VARCHAR(50) NULL DEFAULT NULL,
  `estado` VARCHAR(20) NULL DEFAULT 'Activo',
  PRIMARY KEY (`idBus`),
  UNIQUE INDEX `placa` (`placa` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 2
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `satef_azul`.`camara`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `satef_azul`.`camara` (
  `idCamara` INT NOT NULL AUTO_INCREMENT,
  `idBus` INT NULL DEFAULT NULL,
  `estadoCamara` VARCHAR(20) NULL DEFAULT NULL,
  `modeloCamara` VARCHAR(50) NULL DEFAULT NULL,
  `ultimoMantenimiento` DATE NULL DEFAULT NULL,
  PRIMARY KEY (`idCamara`),
  INDEX `idBus` (`idBus` ASC) VISIBLE,
  CONSTRAINT `camara_ibfk_1`
    FOREIGN KEY (`idBus`)
    REFERENCES `satef_azul`.`bus` (`idBus`)
    ON DELETE SET NULL)
ENGINE = InnoDB
AUTO_INCREMENT = 3
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `satef_azul`.`registrofatiga`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `satef_azul`.`registrofatiga` (
  `idRegistroDormida` INT NOT NULL AUTO_INCREMENT,
  `idConductor` INT NULL DEFAULT NULL,
  `idBus` INT NULL DEFAULT NULL,
  `fechaDormida` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `telemetriaEstado` TINYINT(1) NOT NULL,
  `latitud` DECIMAL(10,8) NULL DEFAULT '-17.38950000',
  `longitud` DECIMAL(11,8) NULL DEFAULT '-66.15680000',
  PRIMARY KEY (`idRegistroDormida`),
  INDEX `idConductor` (`idConductor` ASC) VISIBLE,
  INDEX `idBus` (`idBus` ASC) VISIBLE,
  CONSTRAINT `registrofatiga_ibfk_1`
    FOREIGN KEY (`idConductor`)
    REFERENCES `satef_azul`.`conductor` (`idConductor`)
    ON DELETE SET NULL,
  CONSTRAINT `registrofatiga_ibfk_2`
    FOREIGN KEY (`idBus`)
    REFERENCES `satef_azul`.`bus` (`idBus`)
    ON DELETE SET NULL)
ENGINE = InnoDB
AUTO_INCREMENT = 12
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `satef_azul`.`viaje`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `satef_azul`.`viaje` (
  `idViaje` INT NOT NULL AUTO_INCREMENT,
  `idConductor` INT NULL DEFAULT NULL,
  `idBus` INT NULL DEFAULT NULL,
  `origen` VARCHAR(100) NULL DEFAULT NULL,
  `destino` VARCHAR(100) NULL DEFAULT NULL,
  `fechaSalida` DATETIME NULL DEFAULT NULL,
  `fechaLlegada` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`idViaje`),
  INDEX `idConductor` (`idConductor` ASC) VISIBLE,
  INDEX `idBus` (`idBus` ASC) VISIBLE,
  CONSTRAINT `viaje_ibfk_1`
    FOREIGN KEY (`idConductor`)
    REFERENCES `satef_azul`.`conductor` (`idConductor`)
    ON DELETE SET NULL,
  CONSTRAINT `viaje_ibfk_2`
    FOREIGN KEY (`idBus`)
    REFERENCES `satef_azul`.`bus` (`idBus`)
    ON DELETE SET NULL)
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
