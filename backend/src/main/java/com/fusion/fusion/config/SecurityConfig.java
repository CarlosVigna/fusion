package com.fusion.fusion.config;

import com.fusion.fusion.auth.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter filter;

    private final CorsConfigurationSource corsConfigurationSource;

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))

                .csrf(csrf -> csrf.disable())

                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                .authorizeHttpRequests(auth -> auth

                        .requestMatchers(
                                HttpMethod.OPTIONS,
                                "/**"
                        ).permitAll()

                        .requestMatchers(
                                "/auth/login",
                                "/ws/**",
                                "/setup/init"
                        ).permitAll()

                        // Health check do Render — sem isso o Render nao
                        // consegue checar se o servico esta de pe.
                        .requestMatchers(
                                "/actuator/health"
                        ).permitAll()

                        // Autenticado por API key (X-ETL-Key) dentro do
                        // proprio controller, nao por JWT — o ETL local
                        // nao tem usuario logado nem token de sessao.
                        .requestMatchers(
                                "/imports/upload",
                                "/etl/poll",
                                "/etl/heartbeat",
                                "/installations/sync"
                        ).permitAll()

                        .requestMatchers(
                                HttpMethod.POST,
                                "/etl/status"
                        ).permitAll()

                        .requestMatchers(
                                "/vehicles/operational-update"
                        ).hasAnyRole(
                                "ADMIN",
                                "OPERATOR"
                        )

                        .requestMatchers(
                                "/vehicles/**"
                        ).hasRole("ADMIN")

                        .anyRequest().authenticated()
                )

                .addFilterBefore(
                        filter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();

    }

    @Bean
    public PasswordEncoder passwordEncoder() {

        return new BCryptPasswordEncoder();

    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config
    ) throws Exception {

        return config.getAuthenticationManager();

    }

}