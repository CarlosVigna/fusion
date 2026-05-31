package com.fusion.fusion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FusionApplication {

	public static void main(String[] args) {

		SpringApplication.run(
				FusionApplication.class,
				args
		);

	}

}