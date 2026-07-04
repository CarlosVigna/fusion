package com.fusion.fusion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class FusionApplication {

	public static void main(String[] args) {

		// TZ=UTC/-Duser.timezone=UTC no Dockerfile nao bastaram no Render —
		// forca aqui, antes de qualquer conexao com o banco, para garantir
		// que TimeZone.getDefault() seja UTC independente do ambiente do
		// container.
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

		SpringApplication.run(
				FusionApplication.class,
				args
		);

	}

}