/* Alvor · Spanish common names for the species list (species.js).
   One line per genus: Genus=name for the genus|species=name;species=name …
   Where Spanish has no everyday name, nurseries in Spain use the scientific one, and so does this list.
   Another language later: copy this file as species-xx.js with that language's names. */
window.SPECIES_NAMES = window.SPECIES_NAMES || {};
window.SPECIES_NAMES.es = (() => {
const raw = `
Abelia=Abelia|x grandiflora=Abelia
Abies=Abeto|koreana=Abeto coreano;nordmanniana=Abeto del Cáucaso
Abutilon=Abutilón|megapotamicum=Abutilón rastrero
Acacia=Acacia|dealbata=Mimosa;baileyana=Mimosa de Bailey
Acanthus=Acanto|mollis=Acanto
Acer=Arce|palmatum=Arce japonés;campestre=Arce campestre;negundo=Arce negundo
Achillea=Milenrama|millefolium=Milenrama
Aconitum=Acónito|napellus=Acónito
Adiantum=Culantrillo|raddianum=Culantrillo
Aechmea=Aechmea|fasciata=Aechmea
Aeonium=Eonio|arboreum=Bejeque arbóreo;haworthii=Eonio de Haworth
Aesculus=Castaño de Indias|hippocastanum=Castaño de Indias
Agapanthus=Agapanto|africanus=Agapanto africano;praecox=Agapanto
Agave=Agave|americana=Pita;attenuata=Agave cuello de cisne;parryi=Agave de Parry;victoriae-reginae=Agave reina Victoria
Aglaonema=Aglaonema|commutatum=Aglaonema
Ajuga=Búgula|reptans=Búgula
Akebia=Akebia|quinata=Akebia
Albizia=Acacia de Constantinopla|julibrissin=Acacia de Constantinopla
Alcea=Malvarrosa|rosea=Malvarrosa
Alchemilla=Pie de león|mollis=Alquimila
Allium=Ajo ornamental|giganteum=Ajo gigante;schoenoprasum=Cebollino;sativum=Ajo;cepa=Cebolla
Alocasia=Oreja de elefante|amazonica=Alocasia amazónica;macrorrhizos=Taro gigante;odora=Alocasia odora;zebrina=Alocasia cebra;wentii=Alocasia wentii
Aloe=Aloe|vera=Aloe vera;arborescens=Aloe arborescente;striatula=Aloe resistente;polyphylla=Aloe espiral
Aloysia=Hierba luisa|citrodora=Hierba luisa
Alstroemeria=Alstroemeria
Amaryllis=Amarilis|belladonna=Azucena de Guernesey
Anemone=Anémona|x hybrida=Anémona japonesa;coronaria=Anémona de jardín
Anthurium=Anturio|andraeanum=Anturio;clarinervium=Anturio clarinervium
Antirrhinum=Boca de dragón|majus=Boca de dragón
Aquilegia=Aguileña|vulgaris=Aguileña
Araucaria=Araucaria|araucana=Pehuén;heterophylla=Araucaria excelsa
Arbutus=Madroño|unedo=Madroño
Argyranthemum=Margarita|frutescens=Margarita de las Canarias
Arisaema=Arisaema|sikokianum=Arisaema
Armeria=Armeria|maritima=Clavelina de mar
Artemisia=Ajenjo|absinthium=Ajenjo;dracunculus=Estragón
Arum=Aro|italicum=Aro italiano
Aruncus=Barba de cabra|dioicus=Barba de cabra
Asparagus=Espárrago|officinalis=Espárrago;setaceus=Esparraguera plumosa;densiflorus=Esparraguera
Aspidistra=Aspidistra|elatior=Pilistra
Asplenium=Asplenio|nidus=Helecho nido de ave;scolopendrium=Lengua de ciervo
Aster=Áster|amellus=Áster amelo
Astilbe=Astilbe|x arendsii=Astilbe
Aucuba=Aucuba|japonica=Aucuba
Azalea=Azalea
Bambusa=Bambú|multiplex=Bambú de seto
Beaucarnea=Pata de elefante|recurvata=Pata de elefante
Begonia=Begonia|rex=Begonia rex;maculata=Begonia de lunares;grandis=Begonia resistente;semperflorens=Begonia de flor
Berberis=Agracejo|thunbergii=Agracejo japonés;darwinii=Agracejo de Darwin
Bergenia=Bergenia|cordifolia=Hortensia de invierno
Beschorneria=Beschorneria|yuccoides=Beschorneria
Betula=Abedul|pendula=Abedul común;utilis=Abedul del Himalaya
Bougainvillea=Buganvilla|glabra=Buganvilla;spectabilis=Buganvilla
Brachychiton=Braquiquito|populneus=Braquiquito
Brahea=Palmera azul|armata=Palmera azul;edulis=Palmera de Guadalupe
Brugmansia=Floripondio|suaveolens=Floripondio;x candida=Floripondio;sanguinea=Floripondio rojo
Brunnera=Brunnera|macrophylla=Brunnera
Buddleja=Arbusto de las mariposas|davidii=Arbusto de las mariposas
Butia=Palmera de la jalea|capitata=Butiá;odorata=Butiá
Buxus=Boj|sempervirens=Boj
Caladium=Caladio|bicolor=Caladio
Calathea=Calathea|orbifolia=Calathea orbifolia;lancifolia=Calathea serpiente;zebrina=Calathea cebra
Calendula=Caléndula|officinalis=Caléndula
Callistemon=Limpiatubos|citrinus=Limpiatubos;viminalis=Limpiatubos llorón
Calluna=Brecina|vulgaris=Brecina
Camellia=Camelia|japonica=Camelia;sasanqua=Camelia sasanqua;sinensis=Planta del té
Campanula=Campanula|portenschlagiana=Campanilla de Dalmacia;persicifolia=Campanilla de hoja de melocotonero
Campsis=Bignonia|radicans=Bignonia trepadora
Canna=Caña de Indias|indica=Caña de Indias;x generalis=Caña de Indias;musifolia=Caña de Indias de hoja de platanera
Capsicum=Pimiento|annuum=Pimiento;chinense=Chile habanero
Carex=Carex|oshimensis=Carex japonés;buchananii=Carex de Buchanan
Carpinus=Carpe|betulus=Carpe
Catalpa=Catalpa|bignonioides=Catalpa
Ceanothus=Lila de California|thyrsiflorus=Ceanoto
Cedrus=Cedro|atlantica=Cedro del Atlas;deodara=Cedro del Himalaya;libani=Cedro del Líbano
Centaurea=Aciano|cyanus=Aciano;montana=Aciano de montaña
Ceratostigma=Ceratostigma|willmottianum=Plumbago chino
Cercis=Árbol del amor|siliquastrum=Árbol del amor;canadensis=Ciclamor del Canadá
Cereus=Cereus|peruvianus=Cactus del Perú
Cestrum=Cestrum|nocturnum=Galán de noche;elegans=Cestrum púrpura
Chaenomeles=Membrillero de flor|japonica=Membrillero japonés
Chamaedorea=Palmera de salón|elegans=Palmera de salón;radicalis=Chamaedorea radicalis
Chamaerops=Palmito|humilis=Palmito
Chlorophytum=Cinta|comosum=Cinta
Choisya=Naranjo de México|ternata=Naranjo de México
Chrysanthemum=Crisantemo|morifolium=Crisantemo
Cistus=Jara|x purpureus=Jara púrpura;ladanifer=Jara pringosa
Citrus=Cítrico|limon=Limonero;sinensis=Naranjo;reticulata=Mandarino;aurantium=Naranjo amargo;x meyeri=Limonero Meyer;japonica=Kumquat;hystrix=Lima kaffir;aurantiifolia=Limero
Clematis=Clemátide|montana=Clemátide de montaña;armandii=Clemátide perenne;viticella=Clemátide italiana
Clivia=Clivia|miniata=Clivia
Colocasia=Taro|esculenta=Taro;fallax=Taro plateado;gigantea=Taro gigante
Convallaria=Lirio de los valles|majalis=Lirio de los valles
Convolvulus=Correhuela|cneorum=Campanilla plateada;sabatius=Campanilla azul
Coprosma=Coprosma|repens=Coprosma
Cordyline=Cordyline|australis=Cordyline australis;fruticosa=Cordyline
Coreopsis=Coreopsis|verticillata=Coreopsis
Cornus=Cornejo|alba=Cornejo blanco;kousa=Cornejo japonés;florida=Cornejo florido
Cortaderia=Hierba de la Pampa|selloana=Hierba de la Pampa
Corylus=Avellano|avellana=Avellano
Cosmos=Cosmos|bipinnatus=Cosmos;atrosanguineus=Cosmos chocolate
Cotinus=Árbol de las pelucas|coggygria=Árbol de las pelucas
Cotoneaster=Cotoneaster|horizontalis=Cotoneaster rastrero
Crassula=Crassula|ovata=Árbol de jade;perforata=Crassula perforata;arborescens=Jade plateado
Crinum=Crinum|x powellii=Crinum
Crocosmia=Montbretia|x crocosmiiflora=Montbretia;masoniorum=Montbretia gigante
Crocus=Azafrán|vernus=Azafrán de primavera;sativus=Azafrán
Ctenanthe=Ctenanthe|burle-marxii=Ctenanthe
Cucumis=Pepino|sativus=Pepino;melo=Melón
Cucurbita=Calabaza|pepo=Calabacín;maxima=Calabaza
Cupressus=Ciprés|sempervirens=Ciprés común;macrocarpa=Ciprés de Monterrey
Cycas=Cica|revoluta=Cica
Cyclamen=Ciclamen|persicum=Ciclamen;hederifolium=Ciclamen de hoja de hiedra;coum=Ciclamen coum
Cymbidium=Cymbidium
Cynara=Alcachofa|cardunculus=Cardo;scolymus=Alcachofa
Cyperus=Papiro|papyrus=Papiro;alternifolius=Paragüitas
Cyrtomium=Helecho acebo|falcatum=Helecho acebo
Dahlia=Dalia|imperialis=Dalia arbórea;pinnata=Dalia
Daphne=Dafne|odora=Dafne
Dasylirion=Sotol|wheeleri=Sotol;longissimum=Dasylirion
Datura=Estramonio|inoxia=Toloache
Daucus=Zanahoria|carota=Zanahoria
Delphinium=Espuela de caballero|elatum=Espuela de caballero
Dendrobium=Dendrobium|nobile=Dendrobium
Deutzia=Deutzia|gracilis=Deutzia
Dianthus=Clavel|caryophyllus=Clavel;barbatus=Clavel del poeta;plumarius=Clavellina
Dicentra=Corazón sangrante|spectabilis=Corazón sangrante
Dicksonia=Helecho arborescente|antarctica=Helecho arborescente;squarrosa=Helecho arborescente;fibrosa=Helecho arborescente dorado
Dieffenbachia=Diefenbaquia|seguine=Diefenbaquia
Digitalis=Dedalera|purpurea=Dedalera
Dionaea=Venus atrapamoscas|muscipula=Venus atrapamoscas
Dracaena=Drácena|marginata=Drácena marginata;fragrans=Palo de Brasil;draco=Drago;trifasciata=Lengua de suegra;sanderiana=Bambú de la suerte
Drosera=Drosera|capensis=Drosera del Cabo
Dryopteris=Helecho macho|filix-mas=Helecho macho;erythrosora=Helecho de otoño
Echeveria=Echeveria|elegans=Echeveria;agavoides=Echeveria
Echinacea=Equinácea|purpurea=Equinácea
Echinocactus=Asiento de suegra|grusonii=Asiento de suegra
Echinops=Cardo yesquero|ritro=Cardo yesquero
Echium=Tajinaste|candicans=Tajinaste de Madeira;pininana=Tajinaste gigante;wildpretii=Tajinaste rojo
Elaeagnus=Eleagno|x ebbingei=Eleagno
Ensete=Banano de Abisinia|ventricosum=Banano de Abisinia;glaucum=Banano de nieve
Epimedium=Epimedio|x rubrum=Epimedio rojo
Epipremnum=Poto|aureum=Poto;pinnatum=Poto de hoja partida
Equisetum=Cola de caballo|hyemale=Cola de caballo
Erica=Brezo|carnea=Brezo de invierno;arborea=Brezo blanco
Erigeron=Erigeron|karvinskianus=Margarita cimarrona
Eriobotrya=Níspero|japonica=Níspero
Eryngium=Cardo|planum=Cardo azul;agavifolium=Eryngium de hoja de agave
Erysimum=Alhelí|cheiri=Alhelí amarillo;linifolium=Alhelí perenne
Escallonia=Escalonia|rubra=Escalonia
Eucalyptus=Eucalipto|gunnii=Eucalipto gunnii;globulus=Eucalipto blanco
Eucomis=Lirio piña|bicolor=Lirio piña
Euonymus=Bonetero|japonicus=Evónimo;fortunei=Evónimo rastrero
Euphorbia=Euforbia|pulcherrima=Flor de Pascua;milii=Corona de espinas;characias=Lechetrezna mediterránea;trigona=Euforbia trigona;tirucalli=Árbol de los dedos;mellifera=Euforbia de Madeira
Fargesia=Bambú paraguas|murielae=Bambú paraguas;rufa=Bambú fargesia
Fascicularia=Fascicularia|bicolor=Fascicularia
Fatsia=Aralia|japonica=Aralia japonesa;polycarpa=Fatsia de Taiwán
Feijoa=Feijoa|sellowiana=Feijoa
Festuca=Festuca|glauca=Festuca azul
Ficus=Ficus|carica=Higuera;lyrata=Ficus lira;elastica=Árbol del caucho;benjamina=Ficus benjamina;pumila=Ficus trepador;microcarpa=Laurel de Indias
Fittonia=Fitonia|albivenis=Fitonia
Forsythia=Forsitia|x intermedia=Forsitia
Fragaria=Fresa|x ananassa=Fresón;vesca=Fresa silvestre
Freesia=Fresia
Fuchsia=Fucsia|magellanica=Fucsia resistente
Gaillardia=Gallardía|x grandiflora=Gallardía
Galanthus=Campanilla de invierno|nivalis=Campanilla de invierno
Gardenia=Gardenia|jasminoides=Gardenia
Gaura=Gaura|lindheimeri=Gaura
Gazania=Gazania|rigens=Gazania
Geranium=Geranio vivaz|macrorrhizum=Geranio vivaz;sanguineum=Geranio sanguíneo;maderense=Geranio de Madeira
Gerbera=Gerbera|jamesonii=Gerbera
Ginkgo=Ginkgo|biloba=Ginkgo
Gladiolus=Gladiolo|communis=Gladiolo
Gunnera=Gunnera|manicata=Ruibarbo gigante;tinctoria=Nalca
Guzmania=Guzmania|lingulata=Guzmania
Hakonechloa=Hierba japonesa del bosque|macra=Hierba japonesa del bosque
Hamamelis=Hamamelis|x intermedia=Hamamelis;mollis=Hamamelis chino
Haworthia=Haworthia|attenuata=Haworthia cebra;cooperi=Haworthia de Cooper
Hebe=Hebe|pinguifolia=Hebe;x franciscana=Hebe
Hedera=Hiedra|helix=Hiedra común;colchica=Hiedra persa
Hedychium=Lirio jengibre|gardnerianum=Jengibre kahili;coccineum=Lirio jengibre rojo;densiflorum=Lirio jengibre;coronarium=Lirio mariposa;forrestii=Lirio jengibre de Forrest
Helianthus=Girasol|annuus=Girasol
Helichrysum=Siempreviva|italicum=Planta del curry;petiolare=Helicriso plateado
Helleborus=Eléboro|niger=Rosa de Navidad;x hybridus=Rosa de Cuaresma;argutifolius=Eléboro de Córcega
Hemerocallis=Hemerocallis|fulva=Lirio de día
Heuchera=Heuchera|micrantha=Heuchera
Hibiscus=Hibisco|rosa-sinensis=Hibisco;syriacus=Altea;moscheutos=Hibisco de pantano
Hippeastrum=Amarilis|x hybridum=Amarilis
Hosta=Hosta|sieboldiana=Hosta;plantaginea=Hosta de agosto
Hoya=Flor de cera|carnosa=Flor de cera;kerrii=Hoya corazón;linearis=Hoya linearis
Hyacinthus=Jacinto|orientalis=Jacinto
Hydrangea=Hortensia|macrophylla=Hortensia;paniculata=Hortensia paniculata;quercifolia=Hortensia de hoja de roble;petiolaris=Hortensia trepadora;arborescens=Hortensia arbórea;aspera=Hortensia aspera
Hypericum=Hipérico|calycinum=Hipérico rastrero
Iberis=Carraspique|sempervirens=Carraspique perenne
Ilex=Acebo|aquifolium=Acebo;crenata=Acebo japonés
Impatiens=Alegría de la casa|walleriana=Alegría de la casa;hawkeri=Alegría de Nueva Guinea;tinctoria=Impatiens resistente
Iris=Lirio|germanica=Lirio común;sibirica=Lirio de Siberia;pseudacorus=Lirio amarillo
Jasminum=Jazmín|officinale=Jazmín común;polyanthum=Jazmín de invierno chino;nudiflorum=Jazmín de invierno;sambac=Jazmín árabe
Juniperus=Enebro|communis=Enebro común;horizontalis=Enebro rastrero
Kalanchoe=Kalanchoe|blossfeldiana=Kalanchoe;daigremontiana=Aranto;tomentosa=Planta panda;thyrsiflora=Kalanchoe de paleta
Kniphofia=Tritoma|uvaria=Tritoma;caulescens=Tritoma arbórea
Lagerstroemia=Árbol de Júpiter|indica=Árbol de Júpiter
Lantana=Lantana|camara=Lantana
Laurus=Laurel|nobilis=Laurel
Lavandula=Lavanda|angustifolia=Lavanda;stoechas=Cantueso;x intermedia=Lavandín;dentata=Lavanda dentada
Leucanthemum=Margarita|x superbum=Margarita gigante;vulgare=Margarita común
Ligularia=Ligularia|dentata=Ligularia;przewalskii=Ligularia
Ligustrum=Aligustre|japonicum=Aligustre japonés;lucidum=Aligustre
Lilium=Azucena|regale=Lirio real;candidum=Azucena;lancifolium=Lirio tigre
Liquidambar=Liquidámbar|styraciflua=Liquidámbar
Liriodendron=Tulipero|tulipifera=Tulipero de Virginia
Liriope=Liriope|muscari=Liriope
Lithops=Piedras vivas
Lobelia=Lobelia|erinus=Lobelia;cardinalis=Lobelia cardenal;tupa=Tupa
Lonicera=Madreselva|periclymenum=Madreselva;japonica=Madreselva japonesa;nitida=Madreselva de seto
Lupinus=Altramuz|polyphyllus=Lupino
Magnolia=Magnolia|grandiflora=Magnolio;stellata=Magnolia estrellada;x soulangeana=Magnolia de Soulange;liliiflora=Magnolia lirio;kobus=Magnolia kobus
Mahonia=Mahonia|aquifolium=Mahonia;japonica=Mahonia japonesa;x media=Mahonia;eurybracteata=Mahonia
Malus=Manzano|domestica=Manzano;sylvestris=Manzano silvestre
Malva=Malva|sylvestris=Malva
Mandevilla=Dipladenia|sanderi=Dipladenia;laxa=Jazmín de Chile
Maranta=Maranta|leuconeura=Planta de la oración
Matteuccia=Helecho avestruz|struthiopteris=Helecho avestruz
Melianthus=Melianthus|major=Flor de miel
Melissa=Melisa|officinalis=Melisa
Mentha=Menta|spicata=Hierbabuena;x piperita=Menta piperita;suaveolens=Mastranzo
Metasequoia=Metasecuoya|glyptostroboides=Metasecuoya
Miscanthus=Miscanthus|sinensis=Eulalia
Monstera=Costilla de Adán|deliciosa=Costilla de Adán;adansonii=Monstera adansonii;obliqua=Monstera obliqua
Musa=Platanera|basjoo=Platanera;acuminata=Platanera enana;sikkimensis=Platanera de Darjeeling;x paradisiaca=Plátano macho;velutina=Platanera rosa;itinerans=Platanera de Yunnan;balbisiana=Platanera silvestre
Muscari=Nazareno|armeniacum=Nazareno
Myosotis=Nomeolvides|sylvatica=Nomeolvides
Myrtus=Mirto|communis=Arrayán
Nandina=Bambú sagrado|domestica=Bambú sagrado
Narcissus=Narciso|pseudonarcissus=Narciso trompón;tazetta=Narciso de manojo
Nepenthes=Planta jarro
Nepeta=Nébeda|x faassenii=Nébeda;cataria=Hierba gatera
Nephrolepis=Helecho de Boston|exaltata=Helecho de Boston
Nerium=Adelfa|oleander=Adelfa
Nicotiana=Tabaco ornamental|alata=Tabaco de jardín;sylvestris=Tabaco ornamental
Ocimum=Albahaca|basilicum=Albahaca
Olea=Olivo|europaea=Olivo
Opuntia=Chumbera|ficus-indica=Chumbera;microdasys=Orejas de conejo;humifusa=Nopal rastrero
Origanum=Orégano|vulgare=Orégano;majorana=Mejorana
Osmanthus=Osmanto|fragrans=Olivo fragante;x burkwoodii=Osmanto
Osteospermum=Margarita africana|ecklonis=Margarita del Cabo
Oxalis=Acedera|triangularis=Trébol púrpura
Pachysandra=Paquisandra|terminalis=Paquisandra
Paeonia=Peonía|lactiflora=Peonía china;suffruticosa=Peonía arbórea
Papaver=Amapola|orientale=Amapola oriental;rhoeas=Amapola
Parthenocissus=Parra virgen|quinquefolia=Parra virgen;tricuspidata=Viña virgen
Passiflora=Pasionaria|caerulea=Pasionaria;edulis=Maracuyá
Paulownia=Paulonia|tomentosa=Paulonia
Pelargonium=Geranio|x hortorum=Geranio común;peltatum=Gitanilla;graveolens=Geranio de olor;sidoides=Geranio sudafricano
Pennisetum=Pennisetum|alopecuroides=Pennisetum;setaceum=Plumero púrpura
Penstemon=Penstemon|digitalis=Penstemon
Peperomia=Peperomia|obtusifolia=Peperomia;argyreia=Peperomia sandía;caperata=Peperomia caperata;polybotrya=Peperomia gota de lluvia
Perovskia=Salvia rusa|atriplicifolia=Salvia rusa
Persea=Aguacate|americana=Aguacate
Persicaria=Persicaria|amplexicaulis=Bistorta roja
Petroselinum=Perejil|crispum=Perejil
Petunia=Petunia|x atkinsiana=Petunia
Phalaenopsis=Orquídea mariposa|amabilis=Orquídea mariposa
Philadelphus=Celinda|coronarius=Celinda
Philodendron=Filodendro|hederaceum=Filodendro trepador;bipinnatifidum=Filodendro selloum;erubescens=Filodendro rojo;gloriosum=Filodendro gloriosum;birkin=Filodendro Birkin
Phlomis=Salvia de Jerusalén|fruticosa=Matagallo;russeliana=Phlomis turca
Phlox=Flox|paniculata=Flox;subulata=Flox rastrero
Phoenix=Palmera datilera|canariensis=Palmera canaria;dactylifera=Palmera datilera;roebelenii=Palmera enana
Phormium=Lino de Nueva Zelanda|tenax=Lino de Nueva Zelanda;cookianum=Lino de montaña
Photinia=Fotinia|x fraseri=Fotinia Red Robin
Phyllostachys=Bambú|aurea=Bambú dorado;nigra=Bambú negro;edulis=Bambú moso;bissetii=Bambú de Bisset;vivax=Bambú vivax
Picea=Pícea|abies=Abeto rojo;pungens=Pícea azul;glauca=Pícea blanca
Pieris=Pieris|japonica=Pieris
Pilea=Pilea|peperomioides=Planta del dinero china;cadierei=Planta de aluminio
Pinus=Pino|pinea=Pino piñonero;mugo=Pino negro;sylvestris=Pino silvestre;thunbergii=Pino negro japonés
Pittosporum=Pitosporo|tobira=Pitosporo;tenuifolium=Pitosporo de hoja fina
Platanus=Plátano de sombra|x hispanica=Plátano de sombra
Platycerium=Cuerno de alce|bifurcatum=Cuerno de alce
Plectranthus=Plectranthus|scutellarioides=Cóleo;verticillatus=Planta del dinero
Plumbago=Celestina|auriculata=Celestina
Podocarpus=Podocarpo|macrophyllus=Podocarpo
Polygonatum=Sello de Salomón|x hybridum=Sello de Salomón
Polystichum=Helecho|setiferum=Helecho de escudo;polyblepharum=Helecho japonés
Primula=Prímula|vulgaris=Primavera;veris=Prímula;obconica=Prímula obconica
Prunus=Cerezo|avium=Cerezo;persica=Melocotonero;domestica=Ciruelo;armeniaca=Albaricoquero;dulcis=Almendro;laurocerasus=Laurel cerezo;lusitanica=Loro;serrulata=Cerezo japonés
Pseudopanax=Pseudopanax|crassifolius=Pseudopanax;lessonii=Pseudopanax
Pulmonaria=Pulmonaria|officinalis=Pulmonaria
Punica=Granado|granatum=Granado
Pyracantha=Espino de fuego|coccinea=Espino de fuego
Pyrus=Peral|communis=Peral;calleryana=Peral de Callery
Quercus=Roble|robur=Roble común;ilex=Encina;suber=Alcornoque;rubra=Roble americano
Ranunculus=Ranúnculo|asiaticus=Francesilla
Rhapis=Palmera bambú|excelsa=Palmera bambú
Rheum=Ruibarbo|rhabarbarum=Ruibarbo;palmatum=Ruibarbo ornamental
Rhododendron=Rododendro|ponticum=Rododendro;simsii=Azalea de interior;yakushimanum=Rododendro yakushimanum;luteum=Azalea amarilla
Rhus=Zumaque|typhina=Zumaque de Virginia
Ribes=Grosellero|rubrum=Grosellero rojo;nigrum=Grosellero negro;uva-crispa=Grosellero espinoso;sanguineum=Grosellero de flor
Ricinus=Ricino|communis=Ricino
Rosa=Rosal|banksiae=Rosal de Banks;canina=Escaramujo;rugosa=Rosal rugoso;gallica=Rosal de Castilla
Rosmarinus=Romero|officinalis=Romero
Rubus=Zarza|idaeus=Frambueso;fruticosus=Zarzamora
Rudbeckia=Rudbeckia|fulgida=Rudbeckia;hirta=Susana de ojos negros
Ruscus=Rusco|aculeatus=Rusco
Sabal=Palmito|minor=Palmito enano;palmetto=Palmito de Carolina
Saintpaulia=Violeta africana|ionantha=Violeta africana
Salix=Sauce|babylonica=Sauce llorón;alba=Sauce blanco
Salvia=Salvia|officinalis=Salvia común;nemorosa=Salvia de los bosques;rosmarinus=Romero;elegans=Salvia piña;microphylla=Salvia microphylla;guaranitica=Salvia guaranítica;involucrata=Salvia involucrata
Sambucus=Saúco|nigra=Saúco
Sansevieria=Lengua de suegra|trifasciata=Lengua de suegra;cylindrica=Sansevieria cilíndrica
Santolina=Santolina|chamaecyparissus=Abrótano hembra
Sarcococca=Sarcococca|confusa=Sarcococca;hookeriana=Sarcococca del Himalaya
Saxifraga=Saxífraga|x urbium=Saxífraga;stolonifera=Begonia fresa
Schefflera=Cheflera|arboricola=Cheflera enana;actinophylla=Árbol paraguas;taiwaniana=Cheflera de Taiwán;delavayi=Cheflera de Delavay;rhododendrifolia=Cheflera del Himalaya
Schlumbergera=Cactus de Navidad|x buckleyi=Cactus de Navidad;truncata=Cactus de Navidad
Scilla=Escila|siberica=Escila de Siberia
Sedum=Sedum|spectabile=Hierba callera;morganianum=Cola de burro;acre=Pampajarito;rubrotinctum=Dedos de dama
Sempervivum=Siempreviva|tectorum=Siempreviva mayor;arachnoideum=Siempreviva de telaraña
Senecio=Senecio|rowleyanus=Rosario;cineraria=Cineraria marítima;mandraliscae=Senecio azul
Skimmia=Skimmia|japonica=Skimmia
Solanum=Solanum|lycopersicum=Tomatera;melongena=Berenjena;tuberosum=Patata;laxum=Jazmín de papa;crispum=Solano trepador;rantonnetii=Solano azul
Solenostemon=Cóleo|scutellarioides=Cóleo
Sorbus=Serbal|aucuparia=Serbal de cazadores
Spathiphyllum=Espatifilo|wallisii=Espatifilo
Spinacia=Espinaca|oleracea=Espinaca
Spiraea=Espirea|japonica=Espirea japonesa;x vanhouttei=Corona de novia
Stachys=Oreja de oso|byzantina=Oreja de oso
Stipa=Stipa|gigantea=Stipa gigante;tenuissima=Cabello de ángel
Strelitzia=Ave del paraíso|reginae=Ave del paraíso;nicolai=Ave del paraíso blanca
Streptocarpus=Primavera del Cabo|saxorum=Falsa violeta africana
Syngonium=Singonio|podophyllum=Singonio
Syringa=Lila|vulgaris=Lila;meyeri=Lila coreana
Tagetes=Clavel de moro|erecta=Tagete;patula=Clavel de moro
Taxus=Tejo|baccata=Tejo
Tetrapanax=Planta del papel de arroz|papyrifer=Planta del papel de arroz
Thuja=Tuya|occidentalis=Tuya;plicata=Tuya gigante
Thymus=Tomillo|vulgaris=Tomillo;serpyllum=Serpol;citriodorus=Tomillo limonero
Tillandsia=Clavel del aire|usneoides=Barba de viejo;ionantha=Tillandsia ionantha;cyanea=Tillandsia cyanea
Trachelospermum=Jazmín estrellado|jasminoides=Falso jazmín;asiaticum=Jazmín asiático
Trachycarpus=Palmera de Fortune|fortunei=Palmera de Fortune;wagnerianus=Palmera de Wagner;takil=Palmera takil;princeps=Trachycarpus princeps
Tradescantia=Tradescantia|zebrina=Amor de hombre;pallida=Tradescantia púrpura;fluminensis=Amor de hombre;spathacea=Maguey morado
Tropaeolum=Capuchina|majus=Capuchina
Tulipa=Tulipán|gesneriana=Tulipán
Verbena=Verbena|bonariensis=Verbena de Buenos Aires;officinalis=Verbena
Veronica=Verónica|spicata=Verónica
Viburnum=Viburno|tinus=Durillo;opulus=Mundillo;plicatum=Viburno japonés;x bodnantense=Viburno de invierno;davidii=Viburno de David
Vinca=Vinca|minor=Vinca menor;major=Vinca mayor
Viola=Violeta|odorata=Violeta de olor;x wittrockiana=Pensamiento;cornuta=Violeta cornuda
Vitis=Vid|vinifera=Vid;coignetiae=Vid japonesa
Washingtonia=Washingtonia|filifera=Washingtonia;robusta=Palmera de abanico mexicana
Weigela=Weigela|florida=Weigela
Wisteria=Glicinia|sinensis=Glicinia;floribunda=Glicinia japonesa
Yucca=Yuca|elephantipes=Yuca pie de elefante;gloriosa=Yuca;filamentosa=Yuca filamentosa;rostrata=Yuca rostrata;aloifolia=Bayoneta española
Zamioculcas=Zamioculca|zamiifolia=Zamioculca
Zantedeschia=Cala|aethiopica=Cala
Zingiber=Jengibre|officinale=Jengibre;mioga=Jengibre japonés
Zinnia=Zinnia|elegans=Zinnia
`;
  const m = {};
  raw.trim().split("\n").forEach(line => {
    const [head, rest] = line.split("|"), [g, name] = head.split("=");
    m[g] = name;
    (rest || "").split(";").filter(Boolean).forEach(x => { const [ep, n] = x.split("="); m[`${g} ${ep}`] = n; });
  });
  return m;
})();
