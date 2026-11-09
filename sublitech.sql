-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3307
-- Tiempo de generación: 08-11-2026 a las 21:55:24
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sublitech`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalle_pedido`
--

CREATE TABLE `detalle_pedido` (
  `id` int(10) UNSIGNED NOT NULL,
  `id_pedido` int(10) UNSIGNED NOT NULL,
  `id_producto` int(10) UNSIGNED NOT NULL,
  `talla` enum('XS','S','M','L','XL','XXL','Única') NOT NULL DEFAULT 'M',
  `color_base` varchar(50) DEFAULT 'Blanco',
  `cantidad` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `precio_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) GENERATED ALWAYS AS (`cantidad` * `precio_unitario`) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `detalle_pedido`
--

INSERT INTO `detalle_pedido` (`id`, `id_pedido`, `id_producto`, `talla`, `color_base`, `cantidad`, `precio_unitario`) VALUES
(1, 1, 1, 'M', 'Blanco', 3, 65.00),
(2, 1, 3, 'Única', 'Blanco', 2, 40.00),
(3, 2, 1, 'L', 'Blanco', 3, 65.00),
(4, 2, 1, 'XL', 'Blanco', 2, 65.00),
(5, 2, 5, 'Única', 'Blanco', 2, 95.00),
(6, 3, 3, 'Única', 'Blanco', 6, 40.00),
(7, 4, 2, 'M', 'Blanco', 2, 85.00),
(8, 4, 2, 'L', 'Blanco', 2, 85.00),
(9, 4, 4, 'Única', 'Blanco', 1, 60.00),
(10, 5, 5, 'Única', 'Blanco', 4, 95.00),
(11, 6, 6, 'Única', 'Blanco', 8, 75.00),
(12, 7, 2, 'S', 'Blanco', 2, 85.00),
(13, 7, 2, 'M', 'Blanco', 4, 85.00),
(14, 7, 2, 'L', 'Blanco', 3, 85.00),
(15, 7, 2, 'XL', 'Blanco', 1, 85.00),
(16, 8, 1, 'M', 'Blanco', 3, 65.00),
(17, 8, 5, 'Única', 'Blanco', 2, 95.00),
(18, 9, 3, 'Única', 'Blanco', 6, 40.00),
(19, 10, 2, 'M', 'Blanco', 3, 85.00),
(20, 10, 2, 'L', 'Blanco', 3, 85.00),
(21, 11, 5, 'Única', 'Blanco', 2, 95.00),
(22, 11, 6, 'Única', 'Blanco', 2, 75.00),
(23, 12, 4, 'Única', 'Blanco', 2, 60.00),
(24, 12, 3, 'Única', 'Blanco', 2, 40.00),
(25, 13, 1, 'S', 'Blanco', 1, 65.00),
(26, 13, 1, 'M', 'Blanco', 1, 65.00),
(27, 14, 1, 'XS', 'Blanco', 1, 65.00);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedidos`
--

CREATE TABLE `pedidos` (
  `id` int(10) UNSIGNED NOT NULL,
  `id_usuario` int(10) UNSIGNED NOT NULL,
  `estado` enum('En proceso','En diseño','En impresión','En planchado','En costura','Listo para entrega') NOT NULL DEFAULT 'En proceso',
  `monto_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `monto_anticipo` decimal(10,2) NOT NULL DEFAULT 0.00,
  `anticipo_pagado` tinyint(1) NOT NULL DEFAULT 0,
  `metodo_pago` enum('QR','Transferencia','Efectivo') DEFAULT NULL,
  `url_diseno` varchar(500) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `pedidos`
--

INSERT INTO `pedidos` (`id`, `id_usuario`, `estado`, `monto_total`, `monto_anticipo`, `anticipo_pagado`, `metodo_pago`, `url_diseno`, `notas`, `created_at`, `updated_at`) VALUES
(1, 2, 'Listo para entrega', 325.00, 163.00, 1, 'QR', NULL, 'Pedido cumpleaños María — urgente', '2026-02-15 09:30:00', '2026-02-18 16:00:00'),
(2, 3, 'Listo para entrega', 655.00, 328.00, 1, 'Transferencia', NULL, 'Uniformes empresa TechBolivia — 5 poleras + 2 gorras', '2026-02-20 11:00:00', '2026-02-25 14:30:00'),
(3, 4, 'Listo para entrega', 240.00, 120.00, 1, 'QR', NULL, 'Regalo de graduación — tazas personalizadas con foto', '2026-03-01 10:00:00', '2026-03-04 17:00:00'),
(4, 5, 'Listo para entrega', 490.00, 245.00, 1, 'Efectivo', NULL, 'Pedido corporativo Clínica Boliviana — 4 poleras + 1 taza mágica', '2026-03-10 08:45:00', '2026-03-15 11:00:00'),
(5, 6, 'Listo para entrega', 380.00, 190.00, 1, 'QR', NULL, 'Gorras para team de fútbol — diseño escudo del club', '2026-03-22 14:00:00', '2026-03-27 10:00:00'),
(6, 2, 'Listo para entrega', 600.00, 300.00, 1, 'Transferencia', NULL, 'Cojines decorativos — fotos familiares, 8 unidades', '2026-04-01 09:00:00', '2026-04-07 16:00:00'),
(7, 3, 'Listo para entrega', 850.00, 425.00, 1, 'QR', NULL, 'Pedido evento \"Tech Summit Bolivia 2026\" — 10 poleras manga larga', '2026-04-10 07:30:00', '2026-04-16 15:00:00'),
(8, 4, 'En costura', 420.00, 210.00, 1, 'Transferencia', NULL, 'Poleras + gorras para equipo de voleibol', '2026-05-15 10:00:00', '2026-05-22 09:00:00'),
(9, 5, 'En planchado', 240.00, 120.00, 1, 'QR', NULL, 'Tazas corporativas Empresa Nexo Digital Bolivia', '2026-05-17 11:30:00', '2026-05-23 13:00:00'),
(10, 6, 'En impresión', 510.00, 255.00, 1, 'Efectivo', NULL, 'Poleras manga larga para aniversario empresa', '2026-05-19 08:00:00', '2026-05-23 11:00:00'),
(11, 2, 'En diseño', 360.00, 180.00, 1, 'QR', NULL, 'Gorras + cojines para quinceañero de Sofía', '2026-05-21 14:00:00', '2026-05-22 10:00:00'),
(12, 3, 'En diseño', 200.00, 100.00, 0, NULL, NULL, 'Tazas mágicas — boda de Jorge y Paula', '2026-05-24 09:15:00', '2026-11-08 15:02:31'),
(13, 4, 'En diseño', 130.00, 65.00, 0, NULL, NULL, 'Poleras regalo Día de la Madre', '2026-05-24 10:30:00', '2026-11-08 15:02:28'),
(14, 8, 'En impresión', 65.00, 32.50, 1, 'QR', NULL, NULL, '2026-11-08 13:55:38', '2026-11-08 15:02:47');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productos_blancos`
--

CREATE TABLE `productos_blancos` (
  `id` int(10) UNSIGNED NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `categoria` enum('polera','taza','gorra','bolso','cojin','otro') NOT NULL DEFAULT 'otro',
  `precio_base` decimal(10,2) NOT NULL,
  `stock` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `imagen_url` varchar(500) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `productos_blancos`
--

INSERT INTO `productos_blancos` (`id`, `nombre`, `descripcion`, `categoria`, `precio_base`, `stock`, `imagen_url`, `activo`, `created_at`) VALUES
(1, 'Polera Manga Corta', 'Polera 100% poliéster de alta calidad, ideal para sublimación total. Disponible en todas las tallas.', 'polera', 65.00, 119, 'polera_cuello_redondo_6a1ef8783725b.png', 1, '2026-11-07 22:47:46'),
(2, 'Polera Manga Larga', 'Polera manga larga sublimable, tejido técnico que asegura colores vivos y durables.', 'polera', 85.00, 80, 'polera_cuello_redondo_manga_larga_6a1f0d2e72944.png', 1, '2026-11-07 22:47:46'),
(3, 'Taza Cerámica 11oz', 'Taza cerámica recubierta para sublimación, capacidad 325ml. Apta para microondas y lavavajillas.', 'taza', 40.00, 200, 'prod_6a1f18eb22561.webp', 1, '2026-11-07 22:47:46'),
(4, 'Taza Mágica Termosensible', 'Taza que revela el diseño con el calor de la bebida. Efecto sorpresa garantizado.', 'taza', 60.00, 60, 'prod_6a1f187a128ae.png', 1, '2026-11-07 22:47:46'),
(5, 'Gorra', 'Gorra de 5 paneles sublimable en toda la superficie, cierre ajustable trasero.', 'gorra', 95.00, 90, 'prod_6a1f1855f299c.webp', 1, '2026-11-07 22:47:46'),
(6, 'Cojín 40x40', 'Cojín con funda de poliéster para sublimación total, incluye relleno de vellón de alta densidad.', 'cojin', 75.00, 50, 'prod_6a1f1829de48b.png', 1, '2026-11-07 22:47:46'),
(7, 'Polera Cuello V', 'Polera 100% poliéster tacto algodón con elegante cuello en V. Ideal para sublimación total y uso diario.', 'polera', 70.00, 120, 'CUELLOv.png', 1, '2026-11-08 14:40:24'),
(8, 'Polera Tipo Polo (Con Cuello)', 'Polera deportiva tipo polo con cuello y botones. Excelente acabado para logos y diseños corporativos.', 'polera', 95.00, 80, 'CUELLO.png', 1, '2026-11-08 14:40:24');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(10) UNSIGNED NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` enum('cliente','admin') NOT NULL DEFAULT 'cliente',
  `telefono` varchar(20) DEFAULT NULL,
  `ciudad` varchar(100) DEFAULT 'Cochabamba',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol`, `telefono`, `ciudad`, `created_at`, `updated_at`) VALUES
(1, 'Administrador SubliTech', 'admin@sublitech.bo', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '+591 4 456-7890', 'Cochabamba', '2026-11-07 22:47:46', '2026-11-07 22:47:46'),
(2, 'María Fernández Torrez', 'maria@gmail.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cliente', '+591 70123456', 'Cochabamba', '2026-11-07 22:47:46', '2026-11-07 22:47:46'),
(3, 'Carlos Mendoza Ríos', 'carlos@hotmail.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cliente', '+591 71234567', 'La Paz', '2026-11-07 22:47:46', '2026-11-07 22:47:46'),
(4, 'Valentina Mamani Quispe', 'valentina@yahoo.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cliente', '+591 72345678', 'Santa Cruz', '2026-11-07 22:47:46', '2026-11-07 22:47:46'),
(5, 'Rodrigo Mamani Condori', 'rodrigo@gmail.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cliente', '+591 73456789', 'Oruro', '2026-11-07 22:47:46', '2026-11-07 22:47:46'),
(6, 'Camila Herrera Vega', 'camila@outlook.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cliente', '+591 74567890', 'Cochabamba', '2026-11-07 22:47:46', '2026-11-07 22:47:46'),
(7, 'MELY12', 'juradoshelen@gmail.com', '$2b$12$Nn8UjTyv6g5rOWQvCGzwg.pQjlHLfADOZUZ09K4JzhEwYbVmlYrOy', 'admin', '77117592', 'Tarija', '2026-11-07 22:53:21', '2026-11-07 22:53:59'),
(8, 'holoo', 'juradoshele@gmail.com', '$2b$12$x2v0vYlIHmwbbXikJGuTLOI9KdySs3XW95gzdWdxiBSyKKMqkTnRO', 'cliente', '9080989', 'Cochabamba', '2026-11-08 12:48:20', '2026-11-08 12:48:20');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `detalle_pedido`
--
ALTER TABLE `detalle_pedido`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_detalle_pedido` (`id_pedido`),
  ADD KEY `fk_detalle_producto` (`id_producto`);

--
-- Indices de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pedidos_estado` (`estado`),
  ADD KEY `idx_pedidos_usuario` (`id_usuario`),
  ADD KEY `idx_pedidos_fecha` (`created_at`);

--
-- Indices de la tabla `productos_blancos`
--
ALTER TABLE `productos_blancos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_productos_cat` (`categoria`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `detalle_pedido`
--
ALTER TABLE `detalle_pedido`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT de la tabla `productos_blancos`
--
ALTER TABLE `productos_blancos`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `detalle_pedido`
--
ALTER TABLE `detalle_pedido`
  ADD CONSTRAINT `fk_detalle_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos_blancos` (`id`);

--
-- Filtros para la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD CONSTRAINT `fk_pedido_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
