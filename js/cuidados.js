// cuidados.js — Ficha de cuidados sugerida por tipo de planta.
//
// Cuando se identifica una planta con foto (Pl@ntNet devuelve el nombre
// científico), se busca aquí por especie y, si no está, por género, y se
// sugieren luz, riego, ubicación, dificultad, mascotas y tamaño adulto.
// Son SUGERENCIAS generales para el clima de Honduras: siempre se pueden
// cambiar antes de guardar. Si no hay certeza sobre mascotas, se deja vacío.
//
// Formato: [luz, riego, ubicación, dificultad, mascotas, tamaño adulto, etiquetas, consejo]
//   luz:        C = Sol completo · M = Medio sol · S = Sombra
//   riego:      D = Diario / abundante · 2 = 2 a 3 veces por semana · 1 = Una vez por semana
//               Q = Cada 15 días · X = Una vez al mes
//   ubicación:  I = Interior · E = Exterior · A = Interior y exterior
//   dificultad: F = Fácil · M = Media · R = Requiere experiencia
//   mascotas:   T = Tóxica · S = Segura · '' = no se sabe con certeza
//   etiquetas:  p = Para principiantes · l = Poca luz

const CUIDADOS_FICHAS = {
  // ---------- Follaje de interior ----------
  'Aglaonema': ['S', '1', 'I', 'F', 'T', '40 a 90 cm', 'pl', 'Tolera poca luz. Deja secar la capa de arriba de la tierra antes de regar.'],
  'Dracaena trifasciata': ['M', 'Q', 'A', 'F', 'T', '30 a 120 cm', 'pl', 'Casi indestructible. El exceso de agua es su peor enemigo.'],
  'Sansevieria': ['M', 'Q', 'A', 'F', 'T', '30 a 120 cm', 'pl', 'Casi indestructible. El exceso de agua es su peor enemigo.'],
  'Dracaena': ['M', '1', 'A', 'F', 'T', '1 a 3 m', 'pl', 'Luz indirecta. Riega cuando la tierra esté seca al tacto.'],
  'Zamioculcas': ['S', 'Q', 'I', 'F', 'T', '60 a 90 cm', 'pl', 'Aguanta poca luz y olvidos de riego; guarda agua en sus raíces.'],
  'Epipremnum': ['S', '1', 'I', 'F', 'T', 'Colgante o trepadora, varios metros', 'pl', 'Crece rápido en interior; se puede guiar en tutor o dejar colgante.'],
  'Philodendron': ['M', '1', 'I', 'F', 'T', '60 cm a 2 m', 'pl', 'Luz indirecta brillante. Le gusta la humedad y la tierra suelta.'],
  'Monstera': ['M', '1', 'I', 'M', 'T', '1 a 3 m', '', 'Luz indirecta y tutor para trepar. Limpia sus hojas grandes con un paño húmedo.'],
  'Spathiphyllum': ['S', '2', 'I', 'F', 'T', '40 a 80 cm', 'pl', 'Avisa cuando tiene sed: baja las hojas y se recupera al regarla.'],
  'Anthurium': ['M', '1', 'I', 'M', 'T', '30 a 60 cm', '', 'Luz indirecta, sin sol directo. Florece mejor con humedad ambiental.'],
  'Syngonium': ['M', '1', 'I', 'F', 'T', 'Trepadora, 1 a 2 m', 'p', 'Crece rápido. Se poda para mantenerla compacta.'],
  'Alocasia': ['M', '2', 'I', 'R', 'T', '60 cm a 1.5 m', '', 'Necesita humedad y tierra que drene bien. No tolera el encharcamiento.'],
  'Colocasia': ['M', 'D', 'E', 'M', 'T', '1 a 2 m', '', 'Le gusta la tierra siempre húmeda. Ideal cerca de fuentes o estanques.'],
  'Xanthosoma': ['M', '2', 'E', 'F', 'T', '1 a 2 m', '', 'Hojas grandes decorativas. Tierra húmeda y rica en materia orgánica.'],
  'Caladium': ['S', '2', 'A', 'M', 'T', '30 a 60 cm', '', 'Hojas de colores. Pierde el follaje en época seca y rebrota del tubérculo.'],
  'Dieffenbachia': ['M', '1', 'I', 'F', 'T', '60 cm a 1.5 m', 'p', 'Luz indirecta. Su savia irrita; lávate las manos al podarla.'],
  'Calathea': ['S', '2', 'I', 'R', 'S', '30 a 60 cm', 'l', 'Luz suave y humedad alta. Usa agua reposada o de lluvia.'],
  'Goeppertia': ['S', '2', 'I', 'R', 'S', '30 a 60 cm', 'l', 'Luz suave y humedad alta. Usa agua reposada o de lluvia.'],
  'Maranta': ['S', '2', 'I', 'M', 'S', '20 a 40 cm', 'l', 'Cierra sus hojas en la noche. Tierra húmeda, nunca encharcada.'],
  'Ctenanthe': ['S', '2', 'I', 'M', 'S', '40 a 90 cm', 'l', 'Luz indirecta y humedad. Evita el sol directo.'],
  'Stromanthe': ['M', '2', 'I', 'M', 'S', '40 a 90 cm', '', 'Hojas de colores que se intensifican con luz indirecta brillante.'],
  'Chlorophytum': ['M', '1', 'A', 'F', 'S', '20 a 40 cm', 'p', 'Muy resistente. Saca hijuelos que se pueden sembrar aparte.'],
  'Aspidistra': ['S', 'Q', 'I', 'F', 'S', '40 a 70 cm', 'pl', 'Resiste poca luz, sequía y olvidos. Planta muy duradera.'],
  'Peperomia': ['M', '1', 'I', 'F', 'S', '15 a 30 cm', 'p', 'Hojas carnosas: deja secar la tierra entre riegos.'],
  'Pilea': ['M', '1', 'I', 'F', 'S', '20 a 40 cm', 'p', 'Gírala de vez en cuando para que crezca pareja.'],
  'Ficus': ['M', '1', 'A', 'M', 'T', '1 a 3 m en maceta', '', 'No le gustan los cambios de lugar: puede botar hojas al moverla.'],
  'Schefflera': ['M', '1', 'A', 'F', 'T', '1 a 3 m', 'p', 'Resistente. Se poda para darle forma.'],
  'Heptapleurum': ['M', '1', 'A', 'F', 'T', '1 a 3 m', 'p', 'Resistente. Se poda para darle forma.'],
  'Fittonia': ['S', '2', 'I', 'M', 'S', '10 a 15 cm', 'l', 'Se desmaya si le falta agua y revive al regarla. Ideal para terrarios.'],
  'Hypoestes': ['M', '2', 'I', 'F', 'S', '20 a 40 cm', '', 'Hojas pintadas. Se despunta para que crezca tupida.'],
  'Tradescantia': ['M', '1', 'A', 'F', 'T', 'Colgante, 30 a 60 cm', 'p', 'Crece rápido y se reproduce fácil por esqueje.'],
  'Hoya': ['M', 'Q', 'I', 'M', 'S', 'Colgante o trepadora', '', 'Deja secar entre riegos. No cortes los tallos donde salen las flores.'],
  'Begonia': ['M', '1', 'I', 'M', 'T', '20 a 50 cm', '', 'Riega la tierra, no las hojas. Luz indirecta brillante.'],
  'Coleus': ['M', '2', 'A', 'F', 'T', '30 a 60 cm', 'p', 'Despunta las flores para que mantenga hojas grandes y coloridas.'],
  'Plectranthus': ['M', '2', 'A', 'F', '', '30 a 60 cm', 'p', 'Crece rápido y se reproduce fácil por esqueje.'],
  'Saintpaulia': ['M', '1', 'I', 'M', 'S', '10 a 15 cm', '', 'Riega por debajo (en plato) para no mojar las hojas.'],
  'Episcia': ['S', '1', 'I', 'M', 'S', 'Colgante, 15 a 30 cm', '', 'Humedad alta y luz suave.'],
  'Nephrolepis': ['S', '2', 'A', 'M', 'S', '40 a 90 cm', 'l', 'Necesita humedad: rocía sus hojas en días secos.'],
  'Cordyline': ['M', '1', 'A', 'F', 'T', '1 a 3 m', '', 'Colores más intensos con buena luz indirecta.'],
  'Pachira': ['M', '1', 'I', 'F', 'S', '1 a 2 m en maceta', 'p', 'Deja secar la tierra entre riegos. Planta de la buena suerte.'],
  'Beaucarnea': ['C', 'Q', 'A', 'F', 'S', '1 a 2 m en maceta', 'p', 'Guarda agua en su base: riega poco.'],
  'Yucca': ['C', 'Q', 'E', 'F', 'T', '1 a 3 m', 'p', 'Pleno sol y poco riego.'],
  'Strelitzia': ['C', '1', 'E', 'M', 'T', '1 a 2 m', '', 'Necesita mucho sol para florecer.'],

  // ---------- Suculentas ----------
  'Aloe': ['C', 'Q', 'A', 'F', 'T', '30 a 60 cm', 'p', 'Pleno sol o mucha luz. Riega solo cuando la tierra esté seca.'],
  'Haworthia': ['M', 'Q', 'I', 'F', 'S', '5 a 15 cm', 'p', 'Prefiere luz brillante sin sol fuerte de mediodía.'],
  'Haworthiopsis': ['M', 'Q', 'I', 'F', 'S', '5 a 15 cm', 'p', 'Prefiere luz brillante sin sol fuerte de mediodía.'],
  'Gasteria': ['M', 'Q', 'A', 'F', 'S', '10 a 30 cm', 'p', 'Tolera menos luz que otras suculentas.'],
  'Echeveria': ['C', 'Q', 'E', 'F', 'S', '10 a 20 cm', 'p', 'Mucho sol y sustrato que drene. No mojes la roseta.'],
  'Graptopetalum': ['C', 'Q', 'E', 'F', '', '10 a 20 cm', 'p', 'Mucho sol y sustrato que drene.'],
  'Sedum': ['C', 'Q', 'E', 'F', 'S', '5 a 30 cm', 'p', 'Pleno sol. Muy fácil de reproducir por hoja.'],
  'Crassula': ['C', 'Q', 'A', 'F', 'T', '20 cm a 1 m', 'p', 'Pleno sol o mucha luz. Riega poco.'],
  'Kalanchoe': ['C', 'Q', 'A', 'F', 'T', '20 a 40 cm', 'p', 'Mucha luz para florecer. Riega poco.'],
  'Senecio': ['M', 'Q', 'I', 'M', 'T', 'Colgante, 30 a 60 cm', '', 'Luz brillante y riego escaso.'],
  'Curio': ['M', 'Q', 'I', 'M', 'T', 'Colgante, 30 a 60 cm', '', 'Luz brillante y riego escaso.'],
  'Euphorbia': ['C', 'Q', 'A', 'F', 'T', 'Varía según la especie', '', 'Su savia blanca irrita la piel: usa guantes al manipularla.'],
  'Adenium': ['C', 'Q', 'E', 'M', 'T', '50 cm a 1.5 m', '', 'Pleno sol. Riega poco, sobre todo en época fría.'],
  'Portulaca': ['C', '1', 'E', 'F', 'T', '10 a 20 cm', 'p', 'Pleno sol: sus flores se abren con el sol.'],
  'Ceropegia': ['M', 'Q', 'I', 'F', 'S', 'Colgante, 30 cm a 1 m', 'p', 'Deja secar la tierra entre riegos.'],
  'Agave': ['C', 'X', 'E', 'F', 'T', '50 cm a 1.5 m', 'p', 'Pleno sol y muy poco riego. Cuidado con sus puntas.'],
  'Pachyphytum': ['C', 'Q', 'E', 'F', '', '10 a 20 cm', 'p', 'Mucho sol y sustrato que drene.'],

  // ---------- Cactus ----------
  'Mammillaria': ['C', 'X', 'E', 'F', '', '10 a 20 cm', 'p', 'Pleno sol. Riega solo cuando la tierra esté completamente seca.'],
  'Echinopsis': ['C', 'X', 'E', 'F', '', '15 a 30 cm', 'p', 'Pleno sol. Riega solo cuando la tierra esté completamente seca.'],
  'Gymnocalycium': ['M', 'X', 'E', 'F', '', '5 a 15 cm', 'p', 'Mucha luz, sin quemarse con el sol de mediodía.'],
  'Opuntia': ['C', 'X', 'E', 'F', '', '50 cm a 2 m', 'p', 'Pleno sol y muy poco riego.'],
  'Cereus': ['C', 'X', 'E', 'F', '', '1 a 3 m', 'p', 'Pleno sol y muy poco riego.'],
  'Ferocactus': ['C', 'X', 'E', 'F', '', '20 a 60 cm', 'p', 'Pleno sol y muy poco riego.'],
  'Astrophytum': ['C', 'X', 'E', 'M', '', '10 a 20 cm', '', 'Pleno sol. Muy sensible al exceso de agua.'],
  'Echinocactus': ['C', 'X', 'E', 'F', '', '20 a 60 cm', 'p', 'Pleno sol y muy poco riego.'],
  'Schlumbergera': ['M', '1', 'I', 'F', 'S', 'Colgante, 30 cm', 'p', 'Cactus de selva: luz indirecta y algo más de agua que otros cactus.'],
  'Epiphyllum': ['M', '1', 'A', 'F', '', 'Colgante, 50 cm a 1 m', '', 'Cactus de selva: luz indirecta y sustrato suelto.'],
  'Selenicereus': ['C', '1', 'E', 'F', '', 'Trepador, varios metros', '', 'Necesita tutor o muro para trepar.'],
  'Hylocereus': ['C', '1', 'E', 'F', '', 'Trepador, varios metros', '', 'Necesita tutor o muro para trepar.'],
  'Rhipsalis': ['M', '1', 'I', 'F', '', 'Colgante, 30 cm a 1 m', 'p', 'Cactus colgante de selva: luz indirecta.'],

  // ---------- Orquídeas ----------
  'Phalaenopsis': ['S', '1', 'I', 'M', 'S', '30 a 60 cm con la vara', 'l', 'Riega cuando las raíces se vean plateadas. Nunca dejes agua en el centro.'],
  'Dendrobium': ['M', '1', 'A', 'M', 'S', '30 a 60 cm', '', 'Luz brillante filtrada. Deja secar un poco entre riegos.'],
  'Cattleya': ['M', '1', 'A', 'R', 'S', '30 a 50 cm', '', 'Mucha luz filtrada y buena ventilación.'],
  'Oncidium': ['M', '1', 'A', 'M', 'S', '30 a 60 cm', '', 'Luz filtrada y humedad.'],
  'Vanda': ['M', 'D', 'E', 'R', 'S', '30 a 90 cm', '', 'Raíces al aire: necesita riego o rocío diario.'],
  'Epidendrum': ['C', '1', 'E', 'F', 'S', '30 cm a 1 m', 'p', 'Orquídea resistente al sol, ideal para jardín.'],
  'Rhyncholaelia': ['M', '1', 'A', 'M', 'S', '20 a 40 cm', '', 'Luz brillante filtrada. Deja secar entre riegos.'],
  'Brassavola': ['M', '1', 'A', 'M', 'S', '20 a 40 cm', '', 'Luz brillante filtrada. Deja secar entre riegos.'],
  'Encyclia': ['M', '1', 'A', 'M', 'S', '20 a 40 cm', '', 'Luz brillante filtrada. Deja secar entre riegos.'],
  'Paphiopedilum': ['S', '1', 'I', 'M', 'S', '20 a 40 cm', 'l', 'Luz suave. Mantén el sustrato apenas húmedo.'],
  'Cymbidium': ['M', '1', 'A', 'M', 'S', '50 cm a 1 m', '', 'Necesita noches frescas para florecer.'],

  // ---------- Bromelias ----------
  'Guzmania': ['M', '1', 'I', 'F', 'S', '30 a 50 cm', 'p', 'Pon agua en el centro de la roseta y cámbiala seguido.'],
  'Tillandsia': ['M', '2', 'A', 'F', 'S', '5 a 30 cm', 'p', 'No necesita tierra: rocíala o sumérgela en agua un rato.'],
  'Aechmea': ['M', '1', 'A', 'F', 'S', '30 a 60 cm', 'p', 'Pon agua en el centro de la roseta.'],
  'Neoregelia': ['M', '1', 'A', 'F', 'S', '20 a 40 cm', 'p', 'Más color con buena luz. Agua en el centro.'],
  'Vriesea': ['M', '1', 'I', 'F', 'S', '30 a 60 cm', 'p', 'Pon agua en el centro de la roseta.'],
  'Cryptanthus': ['M', '1', 'I', 'F', 'S', '10 a 20 cm', 'p', 'Bromelia de tierra: sustrato húmedo, sin encharcar.'],
  'Ananas': ['C', '1', 'E', 'F', 'S', '50 cm a 1 m', 'p', 'Pleno sol. Ornamental y algunas dan piña.'],

  // ---------- Helechos ----------
  'Asplenium': ['S', '2', 'I', 'M', 'S', '40 a 90 cm', 'l', 'Riega la tierra, no el centro. Humedad alta.'],
  'Adiantum': ['S', '2', 'I', 'R', 'S', '30 a 50 cm', 'l', 'Nunca dejes secar la tierra. Mucha humedad.'],
  'Platycerium': ['S', '1', 'A', 'M', 'S', '50 cm a 1 m', 'l', 'Se monta en tabla. Riega sumergiendo la base.'],
  'Davallia': ['S', '1', 'I', 'M', 'S', '30 a 50 cm', 'l', 'Sus raíces peludas quedan por fuera: rocíalas.'],
  'Pteris': ['S', '2', 'I', 'F', 'S', '30 a 60 cm', 'l', 'Tierra húmeda y luz suave.'],
  'Microsorum': ['S', '1', 'I', 'F', 'S', '30 a 60 cm', 'pl', 'Helecho resistente. Luz suave.'],
  'Phlebodium': ['S', '1', 'I', 'F', 'S', '40 a 80 cm', 'pl', 'Helecho resistente de hojas azuladas.'],
  'Selaginella': ['S', '2', 'I', 'M', 'S', '10 a 20 cm', 'l', 'Ideal para terrarios. Humedad constante.'],
  'Asparagus': ['M', '1', 'A', 'F', 'T', 'Colgante, 50 cm a 1 m', 'p', 'Parece helecho pero no lo es. Sus bayas son tóxicas.'],

  // ---------- Palmas y afines ----------
  'Chamaedorea': ['S', '1', 'I', 'F', 'S', '1 a 2 m', 'pl', 'Palma de interior: aguanta poca luz.'],
  'Dypsis': ['M', '1', 'A', 'F', 'S', '2 a 6 m', 'p', 'Palma areca: luz brillante y riego regular.'],
  'Rhapis': ['S', '1', 'I', 'F', 'S', '1 a 3 m', 'pl', 'Palma de interior muy resistente.'],
  'Howea': ['S', '1', 'I', 'F', 'S', '2 a 3 m en maceta', 'pl', 'Palma de interior de crecimiento lento.'],
  'Phoenix': ['C', '1', 'E', 'F', '', '2 a 5 m', 'p', 'Pleno sol. Cuidado con las espinas de la base de las hojas.'],
  'Livistona': ['C', '1', 'E', 'F', '', '3 a 10 m', '', 'Palma abanico de jardín.'],
  'Washingtonia': ['C', '1', 'E', 'F', '', 'Más de 10 m', '', 'Palma de crecimiento rápido para exterior.'],
  'Cycas': ['C', '1', 'E', 'F', 'T', '1 a 3 m', '', 'Muy tóxica para perros y gatos, sobre todo las semillas.'],
  'Zamia': ['M', '1', 'A', 'F', 'T', '50 cm a 1 m', '', 'Muy tóxica para mascotas. Crecimiento lento.'],

  // ---------- Flor y arbustos de jardín ----------
  'Bougainvillea': ['C', '1', 'E', 'F', '', 'Trepadora, varios metros', 'p', 'Florece más con pleno sol y riego escaso.'],
  'Hibiscus': ['C', '2', 'E', 'F', 'S', '1 a 3 m', 'p', 'Pleno sol. Se poda para que dé más flores.'],
  'Ixora': ['C', '2', 'E', 'F', '', '1 a 2 m', 'p', 'Pleno sol o medio sol. Ideal para setos.'],
  'Codiaeum': ['C', '1', 'A', 'F', 'T', '1 a 2 m', 'p', 'Más sol, colores más intensos.'],
  'Rosa': ['C', '2', 'E', 'M', 'S', '50 cm a 1.5 m', '', 'Pleno sol, poda frecuente y abono regular.'],
  'Gardenia': ['M', '2', 'E', 'M', 'T', '1 a 1.5 m', '', 'Tierra ácida y húmeda. Flores muy perfumadas.'],
  'Rhododendron': ['M', '2', 'E', 'M', 'T', '50 cm a 1.5 m', '', 'Azalea: tierra ácida y clima fresco.'],
  'Plumeria': ['C', 'Q', 'E', 'F', '', '2 a 5 m', 'p', 'Pleno sol. Riega poco en época seca.'],
  'Nerium': ['C', '1', 'E', 'F', 'T', '2 a 4 m', '', 'Muy tóxica si se come, para personas y mascotas.'],
  'Lantana': ['C', '1', 'E', 'F', 'T', '50 cm a 1.5 m', 'p', 'Pleno sol. Atrae mariposas.'],
  'Allamanda': ['C', '2', 'E', 'F', 'T', 'Trepadora, varios metros', 'p', 'Pleno sol y riego regular.'],
  'Duranta': ['C', '1', 'E', 'F', 'T', '1 a 3 m', 'p', 'Ideal para setos. Sus frutos son tóxicos.'],
  'Jasminum': ['C', '2', 'E', 'F', 'S', 'Trepadora, 2 a 3 m', 'p', 'Flores perfumadas. Pleno sol o medio sol.'],
  'Murraya': ['C', '1', 'E', 'F', '', '1 a 3 m', 'p', 'Limonaria: setos perfumados.'],
  'Catharanthus': ['C', '1', 'E', 'F', 'T', '30 a 60 cm', 'p', 'Pleno sol. Florece casi todo el año.'],
  'Impatiens': ['S', '2', 'A', 'F', 'S', '20 a 40 cm', 'l', 'Florece en sombra. Tierra siempre húmeda.'],
  'Petunia': ['C', '2', 'E', 'F', 'S', '20 a 40 cm', 'p', 'Pleno sol. Quita las flores secas para que salgan más.'],
  'Pelargonium': ['C', '1', 'E', 'F', 'T', '30 a 60 cm', 'p', 'Pleno sol y riego moderado.'],
  'Chrysanthemum': ['C', '2', 'E', 'M', 'T', '30 a 60 cm', '', 'Pleno sol. Florece mejor con días cortos.'],
  'Zinnia': ['C', '2', 'E', 'F', 'S', '30 a 80 cm', 'p', 'Pleno sol. Florece mucho y atrae mariposas.'],
  'Pentas': ['C', '2', 'E', 'F', '', '30 a 60 cm', 'p', 'Pleno sol. Atrae colibríes y mariposas.'],
  'Heliconia': ['M', '2', 'E', 'M', '', '1 a 3 m', '', 'Tierra húmeda y rica. Flor tropical de larga duración.'],
  'Alpinia': ['M', '2', 'E', 'M', '', '1.5 a 3 m', '', 'Tierra húmeda y medio sol.'],
  'Zingiber': ['M', '2', 'E', 'M', '', '1 a 2 m', '', 'Tierra húmeda y medio sol.'],
  'Hydrangea': ['M', '2', 'E', 'M', 'T', '1 a 1.5 m', '', 'Clima fresco y riego abundante.'],
  'Fuchsia': ['M', '2', 'A', 'M', 'S', '30 cm a 1 m', '', 'Clima fresco y sombra parcial.'],
  'Gerbera': ['C', '1', 'A', 'M', 'S', '30 a 45 cm', '', 'Riega la tierra, no el centro de la planta.'],
  'Mandevilla': ['C', '1', 'E', 'F', '', 'Trepadora, 2 a 3 m', 'p', 'Pleno sol o medio sol. Necesita tutor.'],
  'Thunbergia': ['C', '2', 'E', 'F', '', 'Trepadora, varios metros', 'p', 'Crece rápido. Necesita apoyo para trepar.'],
  'Acalypha': ['C', '1', 'E', 'F', '', '1 a 2 m', 'p', 'Pleno sol. Ideal para setos de color.'],
  'Brunfelsia': ['M', '1', 'E', 'M', 'T', '1 a 2 m', '', 'Flores que cambian de color. Muy tóxica para perros.'],

  // ---------- Árboles ornamentales y frutales ----------
  'Delonix': ['C', '1', 'E', 'F', '', 'Árbol de 8 a 12 m', '', 'Malinche: pleno sol y espacio amplio.'],
  'Tabebuia': ['C', '1', 'E', 'F', '', 'Árbol de 5 a 15 m', '', 'Pleno sol. Florece en época seca.'],
  'Handroanthus': ['C', '1', 'E', 'F', '', 'Árbol de 5 a 15 m', '', 'Pleno sol. Florece en época seca.'],
  'Citrus': ['C', '2', 'E', 'M', 'T', '2 a 5 m', '', 'Pleno sol y abono regular para dar fruta.'],
  'Mangifera': ['C', '1', 'E', 'F', '', 'Árbol de 10 m o más', '', 'Pleno sol y espacio amplio.'],
  'Persea': ['C', '1', 'E', 'M', 'T', 'Árbol de 5 a 10 m', '', 'Aguacate: tierra que drene bien. Tóxico para mascotas.'],
  'Psidium': ['C', '1', 'E', 'F', '', '3 a 6 m', 'p', 'Guayabo: resistente y productivo.'],

  // ---------- Enredaderas y colgantes ----------
  'Dischidia': ['M', '1', 'I', 'M', '', 'Colgante', '', 'Epífita: sustrato suelto y humedad.'],
  'Columnea': ['M', '1', 'I', 'M', 'S', 'Colgante, 30 a 60 cm', '', 'Luz indirecta y humedad.'],
  'Aeschynanthus': ['M', '1', 'I', 'M', 'S', 'Colgante, 30 a 60 cm', '', 'Luz indirecta y humedad.'],
  'Hedera': ['M', '1', 'A', 'F', 'T', 'Trepadora, varios metros', 'p', 'Hiedra: se adapta a interior y exterior.'],
  'Ipomoea': ['C', '2', 'E', 'F', 'T', 'Trepadora, varios metros', 'p', 'Crece rápido con pleno sol.'],

  // ---------- Aromáticas, medicinales y comestibles ----------
  'Ocimum': ['C', '2', 'E', 'F', 'S', '30 a 60 cm', 'p', 'Albahaca: pleno sol. Corta las flores para que dé más hojas.'],
  'Mentha': ['M', 'D', 'A', 'F', 'T', '30 a 60 cm', 'p', 'Hierbabuena: le gusta la tierra húmeda. Se expande rápido.'],
  'Salvia rosmarinus': ['C', '1', 'E', 'F', 'S', '50 cm a 1 m', 'p', 'Romero: pleno sol y poco riego.'],
  'Rosmarinus': ['C', '1', 'E', 'F', 'S', '50 cm a 1 m', 'p', 'Romero: pleno sol y poco riego.'],
  'Cymbopogon': ['C', '2', 'E', 'F', 'T', '1 a 1.5 m', 'p', 'Zacate de limón: pleno sol y riego regular.'],
  'Coriandrum': ['M', '2', 'E', 'F', 'S', '20 a 50 cm', 'p', 'Culantro: se siembra seguido porque florece rápido.'],
  'Eryngium': ['M', '2', 'E', 'F', '', '20 a 40 cm', 'p', 'Culantro de monte: medio sol y tierra húmeda.'],
  'Origanum': ['C', '1', 'E', 'F', 'S', '30 a 60 cm', 'p', 'Pleno sol y poco riego.'],
  'Thymus': ['C', '1', 'E', 'F', 'S', '20 a 30 cm', 'p', 'Tomillo: pleno sol y poco riego.'],
  'Lavandula': ['C', '1', 'E', 'M', 'T', '30 a 60 cm', '', 'Pleno sol, poco riego y buen drenaje.'],
  'Capsicum': ['C', '2', 'E', 'F', '', '40 a 80 cm', 'p', 'Chile: pleno sol y abono regular.'],
  'Solanum': ['C', '2', 'E', 'M', 'T', '50 cm a 1.5 m', '', 'Pleno sol y riego regular.'],
  'Moringa': ['C', '1', 'E', 'F', '', 'Árbol de 5 a 10 m', 'p', 'Pleno sol. Resiste la sequía.'],

  // ---------- Acuáticas ----------
  'Nymphaea': ['C', 'D', 'E', 'M', 'S', 'Flota en estanque', '', 'Nenúfar: pleno sol y agua tranquila.'],
  'Pistia': ['M', 'D', 'E', 'F', '', 'Flotante, 10 a 15 cm', 'p', 'Lechuga de agua: se multiplica rápido.'],
  'Pontederia': ['C', 'D', 'E', 'F', '', 'Flotante', 'p', 'Jacinto de agua: se multiplica muy rápido.'],
  'Cyperus': ['C', 'D', 'E', 'F', 'S', '60 cm a 1.5 m', 'p', 'Papiro: le gusta tener las raíces en agua.'],
  'Equisetum': ['M', 'D', 'E', 'F', 'T', '50 cm a 1 m', 'p', 'Cola de caballo: tierra encharcada o en agua.'],

  // ---------- Cubresuelos y grama ----------
  'Stenotaphrum': ['C', '2', 'E', 'F', 'S', 'Grama', 'p', 'Grama San Agustín: tolera algo de sombra.'],
  'Zoysia': ['C', '2', 'E', 'F', 'S', 'Grama', 'p', 'Grama fina de crecimiento lento.'],
  'Ophiopogon': ['M', '1', 'E', 'F', 'S', '15 a 30 cm', 'p', 'Cubresuelos resistente para bordes.'],
  'Arachis': ['C', '1', 'E', 'F', 'S', 'Cubresuelos, 15 cm', 'p', 'Maní forrajero: cubre rápido y da flores amarillas.'],
};

const _LUZ = { C: 'Sol completo', M: 'Medio sol', S: 'Sombra' };
const _RIEGO = { D: 'Diario / abundante', 2: '2 a 3 veces por semana', 1: 'Una vez por semana', Q: 'Cada 15 días', X: 'Una vez al mes' };
const _UBIC = { I: 'Interior', E: 'Exterior', A: 'Interior y exterior' };
const _DIF = { F: 'Fácil', M: 'Media', R: 'Requiere experiencia' };
const _MASC = { T: 'Tóxica para mascotas', S: 'Segura para mascotas' };

function _expandirFicha(f, clave) {
  return {
    clave,
    tipoSol: _LUZ[f[0]] || '',
    riego: _RIEGO[f[1]] || '',
    ubicacion: _UBIC[f[2]] || '',
    dificultad: _DIF[f[3]] || '',
    mascotas: _MASC[f[4]] || '',
    tamanoAdulto: f[5] || '',
    etiquetas: [...(f[6] || '')].map((c) => (c === 'p' ? 'Para principiantes' : c === 'l' ? 'Poca luz' : '')).filter(Boolean),
    consejo: f[7] || '',
  };
}

// Busca la ficha por especie ("Dracaena trifasciata") y si no, por género ("Dracaena").
function fichaCuidados(nombreCientifico) {
  const partes = String(nombreCientifico || '').trim().split(/\s+/);
  if (!partes[0]) return null;
  const genero = partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase();
  const especie = partes[1] ? `${genero} ${partes[1].toLowerCase()}` : '';
  if (especie && CUIDADOS_FICHAS[especie]) return _expandirFicha(CUIDADOS_FICHAS[especie], especie);
  if (CUIDADOS_FICHAS[genero]) return _expandirFicha(CUIDADOS_FICHAS[genero], genero);
  return null;
}

window.Cuidados = { fichaCuidados, total: Object.keys(CUIDADOS_FICHAS).length };
