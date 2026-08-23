
delete from public.sim_auscultation_sounds where audio_url like '/sim-sounds/%';

insert into public.sim_auscultation_sounds (category, region, finding_key, label, description, audio_url, license) values
('cardiaca','foco mitral','normal','Bulhas normofonéticas','Ritmo cardíaco regular em dois tempos, bulhas normofonéticas, sem sopros.','/sim-sounds/cardiaca_normal.mp3','sintetizado — MEDPLEX'),
('cardiaca','foco mitral','taquicardia','Taquicardia','Ritmo regular com frequência elevada.','/sim-sounds/cardiaca_taquicardia.mp3','sintetizado — MEDPLEX'),
('cardiaca','foco mitral','arritmia','Ritmo irregular','Intervalos irregulares entre as bulhas.','/sim-sounds/cardiaca_arritmia.mp3','sintetizado — MEDPLEX'),
('cardiaca','foco mitral','sopro_sistolico','Sopro sistólico','Sopro entre B1 e B2.','/sim-sounds/cardiaca_sopro_sistolico.mp3','sintetizado — MEDPLEX'),
('cardiaca','foco aórtico','sopro_diastolico','Sopro diastólico','Sopro após B2.','/sim-sounds/cardiaca_sopro_diastolico.mp3','sintetizado — MEDPLEX'),
('cardiaca','foco pulmonar','hiperfonese_b2','Hiperfonese de B2','Segunda bulha acentuada.','/sim-sounds/cardiaca_hiperfonese_b2.mp3','sintetizado — MEDPLEX'),
('cardiaca','borda esternal','atrito_pericardico','Atrito pericárdico','Ruído áspero em vaivém.','/sim-sounds/cardiaca_atrito_pericardico.mp3','sintetizado — MEDPLEX'),
('pulmonar','bases','normal','Murmúrio vesicular preservado','Murmúrio vesicular universalmente audível, sem ruídos adventícios.','/sim-sounds/pulmonar_normal.mp3','sintetizado — MEDPLEX'),
('pulmonar','bases','murmurio_vesicular_diminuido','Murmúrio vesicular diminuído','Redução global do murmúrio vesicular.','/sim-sounds/pulmonar_murmurio_vesicular_diminuido.mp3','sintetizado — MEDPLEX'),
('pulmonar','bases','estertores_crepitantes','Estertores crepitantes','Crepitações finas no fim da inspiração.','/sim-sounds/pulmonar_estertores_crepitantes.mp3','sintetizado — MEDPLEX'),
('pulmonar','difuso','sibilos','Sibilos','Sibilos expiratórios difusos.','/sim-sounds/pulmonar_sibilos.mp3','sintetizado — MEDPLEX'),
('pulmonar','difuso','sibilos_e_estertores_difusos','Sibilos e estertores','Sibilos associados a crepitações difusas.','/sim-sounds/pulmonar_sibilos_e_estertores_difusos.mp3','sintetizado — MEDPLEX'),
('abdominal','quadrantes','normal','Ruídos hidroaéreos presentes','RHA presentes e normoativos.','/sim-sounds/abdominal_normal.mp3','sintetizado — MEDPLEX'),
('abdominal','quadrantes','ruidos_hidroaereos_aumentados','RHA aumentados','Ruídos hidroaéreos hiperativos, timbre metálico.','/sim-sounds/abdominal_ruidos_hidroaereos_aumentados.mp3','sintetizado — MEDPLEX'),
('abdominal','quadrantes','ruidos_hidroaereos_diminuidos','RHA diminuídos','Ruídos hidroaéreos escassos.','/sim-sounds/abdominal_ruidos_hidroaereos_diminuidos.mp3','sintetizado — MEDPLEX'),
('abdominal','quadrantes','ruidos_hidroaereos_ausentes','RHA ausentes','Silêncio abdominal.','/sim-sounds/abdominal_ruidos_hidroaereos_ausentes.mp3','sintetizado — MEDPLEX'),
('carotida','carótidas','normal','Carótidas sem sopros','Pulso carotídeo audível sem sopros.','/sim-sounds/carotida_normal.mp3','sintetizado — MEDPLEX'),
('carotida','carótidas','sopro_sistolico','Sopro carotídeo','Sopro sistólico sobre a carótida.','/sim-sounds/carotida_sopro_sistolico.mp3','sintetizado — MEDPLEX'),
('percussao','tórax/abdome','normal','Som claro pulmonar','Percussão com som claro pulmonar.','/sim-sounds/percussao_normal.mp3','sintetizado — MEDPLEX'),
('percussao','abdome','timpanico','Timpanismo','Som timpânico à percussão.','/sim-sounds/percussao_timpanico.mp3','sintetizado — MEDPLEX'),
('percussao','tórax','macicez','Macicez','Som maciço à percussão.','/sim-sounds/percussao_macicez.mp3','sintetizado — MEDPLEX'),
('percussao','tórax','submacicez','Submacicez','Som submaciço à percussão.','/sim-sounds/percussao_submacicez.mp3','sintetizado — MEDPLEX');

create table if not exists public.sim_exam_images (
  id uuid primary key default gen_random_uuid(),
  pattern text not null,
  label text not null,
  image_url text not null,
  report_hint text,
  created_at timestamptz not null default now()
);

grant select on public.sim_exam_images to authenticated;
grant all on public.sim_exam_images to service_role;
alter table public.sim_exam_images enable row level security;

drop policy if exists sim_exam_images_read on public.sim_exam_images;
create policy sim_exam_images_read on public.sim_exam_images for select to authenticated using (true);

delete from public.sim_exam_images;
insert into public.sim_exam_images (pattern, label, image_url, report_hint) values
('ecg_isquemia','ECG com supradesnivelamento de ST','/sim-exams/ecg-supra-st.jpg','traçado com supra de ST'),
('ecg','Eletrocardiograma','/sim-exams/ecg-normal.jpg','traçado de 12 derivações'),
('rx_torax_alterado','Radiografia de tórax com consolidação','/sim-exams/rx-torax-consolidacao.jpg','opacidade/consolidação pulmonar'),
('rx_torax','Radiografia de tórax','/sim-exams/rx-torax-normal.jpg','incidência PA'),
('rx_abdome','Radiografia de abdome','/sim-exams/rx-abdome.jpg','abdome simples'),
('rx_osso','Radiografia osteoarticular','/sim-exams/rx-fratura.jpg','estudo ósseo'),
('tc_cranio','Tomografia de crânio','/sim-exams/tc-cranio-avc.jpg','corte axial'),
('usg_abdome','Ultrassonografia abdominal','/sim-exams/usg-abdome.jpg','janela abdominal');
