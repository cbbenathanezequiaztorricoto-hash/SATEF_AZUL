CREATE DATABASE IF NOT EXISTS satef_azul;
USE satef_azul;

-- Tabla base de Autenticación
CREATE TABLE IF NOT EXISTS Usuario (
    idUsuario INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    passwordHash VARCHAR(255) NOT NULL,
    ultimoLogin DATETIME
);

-- Perfil de Administrador
CREATE TABLE IF NOT EXISTS Administrador (
    idAdministrador INT AUTO_INCREMENT PRIMARY KEY,
    idUsuario INT UNIQUE,
    primerNombreAdmin VARCHAR(50),
    segundoNombreAdmin VARCHAR(50),
    apellidoPaternoAdmin VARCHAR(50),
    apellidoMaternoAdmin VARCHAR(50),
    ci VARCHAR(20),
    telf VARCHAR(20),
    FOREIGN KEY (idUsuario) REFERENCES Usuario(idUsuario) ON DELETE CASCADE
);

-- Perfil de Conductor
CREATE TABLE IF NOT EXISTS Conductor (
    idConductor INT AUTO_INCREMENT PRIMARY KEY,
    idUsuario INT UNIQUE,
    primerNombreConductor VARCHAR(50),
    segundoNombreConductor VARCHAR(50),
    apellidoPaterno VARCHAR(50),
    apellidoMaterno VARCHAR(50),
    ci VARCHAR(20),
    telf VARCHAR(20),
    categoriaLicenciaConducir CHAR(5),
    FOREIGN KEY (idUsuario) REFERENCES Usuario(idUsuario) ON DELETE CASCADE
);

-- Gestión de Flota de Buses
CREATE TABLE IF NOT EXISTS Bus (
    idBus INT AUTO_INCREMENT PRIMARY KEY,
    placa VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'Activo'
);

-- Control de Cámaras en Cabina
CREATE TABLE IF NOT EXISTS Camara (
    idCamara INT AUTO_INCREMENT PRIMARY KEY,
    idBus INT,
    estadoCamara VARCHAR(20),
    modeloCamara VARCHAR(50),
    ultimoMantenimiento DATE,
    FOREIGN KEY (idBus) REFERENCES Bus(idBus) ON DELETE SET NULL
);

-- Registro de Itinerarios y Viajes
CREATE TABLE IF NOT EXISTS Viaje (
    idViaje INT AUTO_INCREMENT PRIMARY KEY,
    idConductor INT,
    idBus INT,
    origen VARCHAR(100),
    destino VARCHAR(100),
    fechaSalida DATETIME,
    fechaLlegada DATETIME,
    FOREIGN KEY (idConductor) REFERENCES Conductor(idConductor) ON DELETE SET NULL,
    FOREIGN KEY (idBus) REFERENCES Bus(idBus) ON DELETE SET NULL
);

-- Módulo de Seguimiento: Telemetría e Historial de Fatiga
CREATE TABLE IF NOT EXISTS RegistroFatiga (
    idRegistroDormida INT AUTO_INCREMENT PRIMARY KEY,
    idConductor INT,
    idBus INT,
    fechaDormida DATETIME DEFAULT CURRENT_TIMESTAMP,
    telemetriaEstado BOOLEAN NOT NULL,
    FOREIGN KEY (idConductor) REFERENCES Conductor(idConductor) ON DELETE SET NULL,
    FOREIGN KEY (idBus) REFERENCES Bus(idBus) ON DELETE SET NULL
);

-- Antecedentes de Conductores
CREATE TABLE IF NOT EXISTS Antecedente (
    idAntecedente INT AUTO_INCREMENT PRIMARY KEY,
    idConductor INT,
    razonAntecedente TEXT,
    fechaAntecedente DATE,
    FOREIGN KEY (idConductor) REFERENCES Conductor(idConductor) ON DELETE CASCADE
);