package com.fusion.fusion.setup;

import com.fusion.fusion.letter.LetterRecord;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.letter.LetterStatus;
import com.fusion.fusion.user.Role;
import com.fusion.fusion.user.User;
import com.fusion.fusion.user.UserRepository;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/setup")
@RequiredArgsConstructor
public class SetupController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final VehicleRepository vehicleRepository;
    private final LetterRecordRepository letterRecordRepository;

    @PostMapping("/init")
    public Map<String, Object> init() {

        if (userRepository.count() > 0) {
            return Map.of("created", false, "reason", "Users already exist");
        }

        User admin = User.builder()
                .name("Carlos Garcia")
                .email("admin@fusion.com")
                .password(passwordEncoder.encode("fusion123"))
                .role(Role.ADMIN)
                .build();

        userRepository.save(admin);

        return Map.of("created", true);

    }

    @PostMapping("/insert-letters")
    public Map<String, Object> insertLetters() {

        List<Map<String, Object>> cartas = List.of(
                Map.of("plate", "RFQ1E88", "insuredName", "RENE CANDIDO DA SILVA", "base", "MULTIPORTAL", "modelo", "FIAT ARGO DRIVE 1.0 6V Flex", "ultimaPosicao", "2026-06-29", "dataEnvio", "2026-06-07", "fimVigencia", "2026-09-13", "operador", "CARLOS"),
                Map.of("plate", "OGF5D31", "insuredName", "THIAGO RAMOS MACHADO DA SILVA", "base", "MULTIPORTAL", "modelo", "NISSAN KICKS", "ultimaPosicao", "2026-06-21", "dataEnvio", "2026-06-30", "fimVigencia", "2026-08-24", "operador", "CARLOS"),
                Map.of("plate", "PRH3J98", "insuredName", "WAGNER VITOR DA SILVA", "base", "MULTIPORTAL", "modelo", "PRISMA", "ultimaPosicao", "2026-06-17", "dataEnvio", "2026-06-23", "fimVigencia", "2026-07-09", "operador", "SARAH"),
                Map.of("plate", "QYD5I12", "insuredName", "ANDREA MARIA DE LIMA C. SILVA DE MENEZ", "base", "MULTIPORTAL", "modelo", "ONIX", "ultimaPosicao", "2026-06-08", "dataEnvio", "2026-06-19", "fimVigencia", "2026-07-28", "operador", "SARAH"),
                Map.of("plate", "END5218", "insuredName", "MARCO ANTONIO DOS SANTOS", "base", "MULTIPORTAL", "modelo", "FIAT/ARGO", "ultimaPosicao", "2025-12-16", "dataEnvio", "2026-01-18", "fimVigencia", "2026-11-15", "operador", "RAFAEL"),
                Map.of("plate", "GEU1E94", "insuredName", "RODRIGO JOSE DOMINGOS DA LUZ", "base", "MULTIPORTAL", "modelo", "KWID", "ultimaPosicao", "2026-03-02", "dataEnvio", "2026-02-01", "fimVigencia", "2026-09-28", "operador", "THAIS")
        );

        int inserted = 0;
        int skipped = 0;

        for (Map<String, Object> c : cartas) {

            var vehicleOpt = vehicleRepository.findByPlate((String) c.get("plate"));

            if (vehicleOpt.isEmpty()) {
                skipped++;
                continue;
            }

            Vehicle vehicle = vehicleOpt.get();
            LocalDate dataEnvio = LocalDate.parse((String) c.get("dataEnvio"));

            if (letterRecordRepository.existsByVehicleAndDataEnvio(vehicle, dataEnvio)) {
                skipped++;
                continue;
            }

            LetterRecord letter = new LetterRecord();
            letter.setVehicle(vehicle);
            letter.setInsuredName((String) c.get("insuredName"));
            letter.setBase((String) c.get("base"));
            letter.setModelo((String) c.get("modelo"));
            letter.setUltimaPosicao(LocalDate.parse((String) c.get("ultimaPosicao")));
            letter.setDataEnvio(dataEnvio);
            letter.setFimVigencia(LocalDate.parse((String) c.get("fimVigencia")));
            letter.setOsAberta("NÃO");
            letter.setDataRetornoSinal("Sem retorno.");
            letter.setOperador((String) c.get("operador"));
            letter.setStatus(LetterStatus.ATIVA);
            letterRecordRepository.save(letter);

            inserted++;

        }

        return Map.of("inserted", inserted, "skipped", skipped);

    }

}
