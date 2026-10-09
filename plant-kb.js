/* Alvor · plant knowledge. What Alvor knows about each kind of plant, kept apart from your plants.
   Your plants keep only what's yours (spot, photos, notes, watering, history, and any value you set yourself);
   everything here is what Alvor brings, so a better value here reaches every plant that follows Alvor.
   Shared by the app (browser), the notify function (copied in by tests/notify-sync.js) and the tests.

   One entry per genus, with its species under sp. A species adds to its genus and wins over it.
     n     common name in English (other languages: species-es.js…). Entries with a name are offered in the
           species search; entries without one are still used when someone types that plant.
     f     family (genus only)
     min   lowest temperature (°C) before damage, for an established plant in the ground in a dry, sheltered spot.
           Pots are treated as 1 °C more tender by the care rules. Plants that die back and regrow (hostas, many
           perennials) get the cold their roots take. Typical values from nursery and hardiness references:
           young plants, wet winters and long cold spells all make a plant more tender.
     pat   through the year: o outside all year, m outside in summer and inside in winter, g greenhouse in winter,
           i inside all year. Left out, it follows min (−5 or colder: o, 10 or warmer: i, else m).
     ws/ww watering interval in days, summer and winter (left out: from the water need d, else the app's default).
     t     traits beyond the lowest temperature:
             c 1  protect the crown or growing point      r °C  roots survive to this when the top doesn't
             s °C new growth or blossom damaged below this in spring
             w 1  wet cold harms it more than dry cold    b 1   big leaves that tear in wind
             d    water need: 1 dry (succulents, cacti), 3 moist (ferns, marginals); used for new plants' intervals
     note  a care note shown with the plant (translated in js/lang-es.js)
     list  1: one of the plants Alvor started with; its values are the ones the care tests check.

   Where a value comes from and how sure Alvor is (find() gives both):
     list     Alvor's starting list                        species  typical for that species
     genus    typical for the genus (only the genus given)  related  the species isn't here, so from its genus
     A genus value is a "rough guess" when the genus's species differ by more than 4 °C. */
(function(root, factory){
  const lib = factory();
  if(typeof module === "object" && module.exports) module.exports = lib;
  else root.AlvorKB = lib;
})(typeof self !== "undefined" ? self : this, function(){
"use strict";
const VERSION = "2026-10-09.kb-1";
const DATA = {
"Abelia":{n:"Abelia", f:"Caprifoliaceae", min:-15, sp:{
  "x grandiflora":{n:"Glossy abelia"}
}},
"Abies":{n:"Fir", f:"Pinaceae", min:-30, sp:{
  "koreana":{n:"Korean fir"},
  "nordmanniana":{n:"Nordmann fir"}
}},
"Abutilon":{n:"Flowering maple", f:"Malvaceae", min:0, pat:"m", sp:{
  "megapotamicum":{n:"Trailing abutilon", min:-7}
}},
"Acacia":{n:"Wattle", f:"Fabaceae", min:-5, sp:{
  "dealbata":{n:"Silver wattle", min:-8, pat:"o", note:"Young plants are more tender; flowers are lost below about −5 °C."},
  "baileyana":{n:"Cootamundra wattle", min:-6}
}},
"Acanthus":{n:"Bear's breeches", f:"Acanthaceae", min:-15, sp:{
  "mollis":{n:"Bear's breeches"}
}},
"Acca":{min:-12, sp:{
  "sellowiana":{min:-12}
}},
"Acer":{n:"Maple", f:"Sapindaceae", min:-25, sp:{
  "palmatum":{n:"Japanese maple", min:-20, t:{s:-2}},
  "campestre":{n:"Field maple"},
  "negundo":{n:"Box elder", min:-30}
}},
"Achillea":{n:"Yarrow", f:"Asteraceae", min:-30, sp:{
  "millefolium":{n:"Yarrow"}
}},
"Aconitum":{n:"Monkshood", f:"Ranunculaceae", min:-30, sp:{
  "napellus":{n:"Monkshood"}
}},
"Acorus":{min:-25, t:{d:3}},
"Actinidia":{min:-15, t:{s:-1}, sp:{
  "deliciosa":{min:-12, pat:"o", note:"Spring growth is killed by late frost even when the plant is fine."}
}},
"Adiantum":{n:"Maidenhair fern", f:"Pteridaceae", min:-15, t:{d:3}, sp:{
  "raddianum":{n:"Delta maidenhair fern", min:7, pat:"i"}
}},
"Aechmea":{n:"Urn plant", f:"Bromeliaceae", min:10, pat:"i", sp:{
  "fasciata":{n:"Urn plant"}
}},
"Aeonium":{n:"Aeonium", f:"Crassulaceae", min:3, pat:"m", ws:10, ww:21, t:{w:1,d:1}, list:1, sp:{
  "arboreum":{n:"Tree aeonium", min:2},
  "haworthii":{n:"Haworth's aeonium", min:0}
}},
"Aeschynanthus":{min:13, pat:"i"},
"Aesculus":{n:"Horse chestnut", f:"Sapindaceae", min:-30, sp:{
  "hippocastanum":{n:"Horse chestnut"}
}},
"Agapanthus":{n:"African lily", f:"Amaryllidaceae", min:-8, sp:{
  "africanus":{n:"African lily", min:-3, pat:"m", note:"Evergreen kinds are tender; deciduous kinds take much more cold."},
  "praecox":{n:"Common agapanthus", min:-5}
}},
"Agave":{n:"Agave", f:"Asparagaceae", min:-5, ws:14, ww:45, t:{w:1,d:1}, sp:{
  "americana":{n:"Century plant", min:-5, pat:"o", ws:14, ww:45, note:"Wet cold kills more than dry cold. Keep rain off it in winter.", list:1},
  "attenuata":{n:"Fox tail agave", min:2, pat:"m"},
  "parryi":{n:"Parry's agave", min:-18},
  "victoriae-reginae":{n:"Queen Victoria agave", min:-8},
  "montana":{min:-15},
  "salmiana":{min:-8}
}},
"Aglaonema":{n:"Chinese evergreen", f:"Araceae", min:13, pat:"i", sp:{
  "commutatum":{n:"Chinese evergreen"}
}},
"Ajuga":{n:"Bugle", f:"Lamiaceae", min:-30, sp:{
  "reptans":{n:"Bugleweed"}
}},
"Akebia":{n:"Chocolate vine", f:"Lardizabalaceae", min:-20, sp:{
  "quinata":{n:"Chocolate vine"}
}},
"Albizia":{n:"Silk tree", f:"Fabaceae", min:-15, sp:{
  "julibrissin":{n:"Persian silk tree"}
}},
"Alcea":{n:"Hollyhock", f:"Malvaceae", min:-30, sp:{
  "rosea":{n:"Hollyhock"}
}},
"Alchemilla":{n:"Lady's mantle", f:"Rosaceae", min:-30, sp:{
  "mollis":{n:"Lady's mantle"}
}},
"Allium":{n:"Ornamental onion", f:"Amaryllidaceae", min:-25, sp:{
  "giganteum":{n:"Giant onion"},
  "schoenoprasum":{n:"Chives", min:-30},
  "sativum":{n:"Garlic", min:-20},
  "cepa":{n:"Onion", min:-10}
}},
"Alocasia":{n:"Elephant ear", f:"Araceae", min:10, pat:"m", ws:5, ww:10, t:{b:1}, note:"Tender. Inside once nights drop below about 10 °C.", list:1, sp:{
  "amazonica":{n:"Amazonian elephant ear", min:15, pat:"i"},
  "macrorrhizos":{n:"Giant taro", min:5, pat:"m"},
  "odora":{n:"Night-scented lily", min:0, pat:"m", t:{r:-3}, note:"Roots survive a few degrees of frost under thick mulch; the leaves don't."},
  "zebrina":{n:"Zebra alocasia", min:15, pat:"i"},
  "wentii":{n:"Hardy elephant ear", min:-3, pat:"m", t:{r:-8}, note:"One of the hardiest: the roots can survive about −8 °C under thick mulch."}
}},
"Aloe":{n:"Aloe", f:"Asphodelaceae", min:5, pat:"m", ws:14, ww:30, t:{w:1,d:1}, sp:{
  "vera":{n:"Aloe vera", min:5, pat:"m", ws:14, ww:30, list:1},
  "arborescens":{n:"Candelabra aloe", min:-2, pat:"m"},
  "striatula":{n:"Hardy aloe", min:-10, pat:"o", note:"Keep it dry in winter."},
  "polyphylla":{n:"Spiral aloe", min:-8, pat:"o", note:"Needs very sharp drainage; wet winters kill it."}
}},
"Aloysia":{n:"Lemon verbena", f:"Verbenaceae", min:-6, pat:"o", t:{r:-12}, note:"The top dies back in hard frost and usually regrows from the base.", sp:{
  "citrodora":{n:"Lemon verbena"}
}},
"Alpinia":{min:5, pat:"m"},
"Alstroemeria":{n:"Peruvian lily", f:"Alstroemeriaceae", min:-10},
"Amaryllis":{n:"Amaryllis", f:"Amaryllidaceae", min:-5, sp:{
  "belladonna":{n:"Belladonna lily", min:-7}
}},
"Amorphophallus":{min:10, pat:"m", sp:{
  "konjac":{min:-8, pat:"o", note:"Tubers survive in dry, well-mulched ground."}
}},
"Anemone":{n:"Windflower", f:"Ranunculaceae", min:-25, sp:{
  "x hybrida":{n:"Japanese anemone"},
  "coronaria":{n:"Poppy anemone", min:-10}
}},
"Anethum":{min:-5},
"Annona":{min:-2, pat:"g"},
"Anthurium":{n:"Flamingo flower", f:"Araceae", min:15, pat:"i", sp:{
  "andraeanum":{n:"Flamingo flower"},
  "clarinervium":{n:"Velvet cardboard anthurium"}
}},
"Antirrhinum":{n:"Snapdragon", f:"Plantaginaceae", min:-10, sp:{
  "majus":{n:"Snapdragon"}
}},
"Aquilegia":{n:"Columbine", f:"Ranunculaceae", min:-30, sp:{
  "vulgaris":{n:"Granny's bonnet"}
}},
"Araucaria":{n:"Monkey puzzle", f:"Araucariaceae", min:-15, sp:{
  "araucana":{n:"Monkey puzzle", min:-20},
  "heterophylla":{n:"Norfolk Island pine", min:3, pat:"m"}
}},
"Arbutus":{n:"Strawberry tree", f:"Ericaceae", min:-15, sp:{
  "unedo":{n:"Strawberry tree"}
}},
"Archontophoenix":{min:0, pat:"m"},
"Argyranthemum":{n:"Marguerite", f:"Asteraceae", min:-2, pat:"m", sp:{
  "frutescens":{n:"Marguerite daisy"}
}},
"Arisaema":{n:"Cobra lily", f:"Araceae", min:-15, sp:{
  "sikokianum":{n:"Cobra lily"}
}},
"Armeria":{n:"Thrift", f:"Plumbaginaceae", min:-30, sp:{
  "maritima":{n:"Sea thrift"}
}},
"Artemisia":{n:"Wormwood", f:"Asteraceae", min:-25, sp:{
  "absinthium":{n:"Wormwood"},
  "dracunculus":{n:"Tarragon", min:-20}
}},
"Arum":{n:"Arum", f:"Araceae", min:-15, sp:{
  "italicum":{n:"Italian arum"}
}},
"Aruncus":{n:"Goat's beard", f:"Rosaceae", min:-30, sp:{
  "dioicus":{n:"Goat's beard"}
}},
"Arundo":{min:-15},
"Asimina":{min:-25},
"Asparagus":{n:"Asparagus", f:"Asparagaceae", min:-25, sp:{
  "officinalis":{n:"Asparagus"},
  "setaceus":{n:"Asparagus fern", min:2, pat:"m"},
  "densiflorus":{n:"Foxtail fern", min:0, pat:"m"}
}},
"Aspidistra":{n:"Cast iron plant", f:"Asparagaceae", min:-10, sp:{
  "elatior":{n:"Cast iron plant"}
}},
"Asplenium":{n:"Spleenwort", f:"Aspleniaceae", min:-15, sp:{
  "nidus":{n:"Bird's nest fern", min:13, pat:"i"},
  "scolopendrium":{n:"Hart's tongue fern", min:-25}
}},
"Aster":{n:"Aster", f:"Asteraceae", min:-30, sp:{
  "amellus":{n:"Italian aster"}
}},
"Astilbe":{n:"Astilbe", f:"Saxifragaceae", min:-30, t:{d:3}, sp:{
  "x arendsii":{n:"False goat's beard"}
}},
"Aucuba":{n:"Spotted laurel", f:"Garryaceae", min:-18, sp:{
  "japonica":{n:"Spotted laurel"}
}},
"Azalea":{n:"Azalea", f:"Ericaceae", min:-15},
"Bambusa":{n:"Bamboo", f:"Poaceae", min:-5, sp:{
  "multiplex":{n:"Hedge bamboo", min:-9}
}},
"Beaucarnea":{n:"Ponytail palm", f:"Asparagaceae", min:0, pat:"m", t:{d:1}, sp:{
  "recurvata":{n:"Ponytail palm"}
}},
"Begonia":{n:"Begonia", f:"Begoniaceae", min:10, pat:"m", sp:{
  "rex":{n:"Rex begonia", min:12, pat:"i"},
  "maculata":{n:"Polka dot begonia", min:12, pat:"i"},
  "grandis":{n:"Hardy begonia", min:-15, pat:"o", note:"Hardy begonia: dies back in winter and returns late in spring."},
  "semperflorens":{n:"Wax begonia", min:3, pat:"m"},
  "luxurians":{min:5, pat:"m"}
}},
"Berberis":{n:"Barberry", f:"Berberidaceae", min:-25, sp:{
  "thunbergii":{n:"Japanese barberry"},
  "darwinii":{n:"Darwin's barberry", min:-15}
}},
"Bergenia":{n:"Elephant's ears", f:"Saxifragaceae", min:-30, sp:{
  "cordifolia":{n:"Heartleaf bergenia"}
}},
"Beschorneria":{n:"Beschorneria", f:"Asparagaceae", min:-8, t:{w:1,d:1}, sp:{
  "yuccoides":{n:"Mexican lily"}
}},
"Beta":{min:-5},
"Betula":{n:"Birch", f:"Betulaceae", min:-35, sp:{
  "pendula":{n:"Silver birch"},
  "utilis":{n:"Himalayan birch"}
}},
"Blechnum":{min:-10, sp:{
  "spicant":{min:-20},
  "chilense":{min:-12}
}},
"Bougainvillea":{n:"Bougainvillea", f:"Nyctaginaceae", min:3, pat:"g", ws:5, ww:21, list:1, sp:{
  "glabra":{n:"Paper flower", min:0, pat:"g"},
  "spectabilis":{n:"Great bougainvillea"}
}},
"Brachychiton":{n:"Kurrajong", f:"Malvaceae", min:-6, sp:{
  "populneus":{n:"Kurrajong"}
}},
"Brahea":{n:"Hesper palm", f:"Arecaceae", min:-8, t:{c:1}, sp:{
  "armata":{n:"Mexican blue palm", min:-10},
  "edulis":{n:"Guadalupe palm", min:-4}
}},
"Brassica":{min:-10},
"Brugmansia":{n:"Angel's trumpet", f:"Solanaceae", min:3, pat:"m", ws:2, ww:14, t:{d:3}, note:"Very thirsty in summer. Keep cool and fairly dry indoors in winter.", list:1, sp:{
  "suaveolens":{n:"Angel's trumpet"},
  "x candida":{n:"Angel's trumpet"},
  "sanguinea":{n:"Red angel's trumpet", min:0, pat:"m"}
}},
"Brunnera":{n:"Siberian bugloss", f:"Boraginaceae", min:-30, sp:{
  "macrophylla":{n:"Siberian bugloss"}
}},
"Buddleja":{n:"Butterfly bush", f:"Scrophulariaceae", min:-20, sp:{
  "davidii":{n:"Butterfly bush"}
}},
"Butia":{n:"Jelly palm", f:"Arecaceae", min:-10, t:{c:1}, sp:{
  "capitata":{n:"Jelly palm"},
  "odorata":{n:"Pindo palm"}
}},
"Buxus":{n:"Box", f:"Buxaceae", min:-20, sp:{
  "sempervirens":{n:"Common box"}
}},
"Caladium":{n:"Caladium", f:"Araceae", min:15, pat:"i", sp:{
  "bicolor":{n:"Angel wings"}
}},
"Calathea":{n:"Calathea", f:"Marantaceae", min:15, pat:"i", t:{d:3}, sp:{
  "orbifolia":{n:"Round-leaf calathea"},
  "lancifolia":{n:"Rattlesnake plant"},
  "zebrina":{n:"Zebra plant"}
}},
"Calendula":{n:"Marigold", f:"Asteraceae", min:-5, sp:{
  "officinalis":{n:"Pot marigold"}
}},
"Callistemon":{n:"Bottlebrush", f:"Myrtaceae", min:-8, sp:{
  "citrinus":{n:"Crimson bottlebrush"},
  "viminalis":{n:"Weeping bottlebrush", min:-5}
}},
"Calluna":{n:"Heather", f:"Ericaceae", min:-25, sp:{
  "vulgaris":{n:"Heather"}
}},
"Caltha":{min:-30, t:{d:3}},
"Camellia":{n:"Camellia", f:"Theaceae", min:-15, sp:{
  "japonica":{n:"Japanese camellia"},
  "sasanqua":{n:"Sasanqua camellia", min:-12},
  "sinensis":{n:"Tea plant", min:-12}
}},
"Campanula":{n:"Bellflower", f:"Campanulaceae", min:-30, sp:{
  "portenschlagiana":{n:"Dalmatian bellflower"},
  "persicifolia":{n:"Peach-leaved bellflower"}
}},
"Campsis":{n:"Trumpet vine", f:"Bignoniaceae", min:-20, sp:{
  "radicans":{n:"Trumpet vine"}
}},
"Canna":{n:"Canna lily", f:"Cannaceae", min:0, pat:"m", ws:3, ww:30, t:{r:-5,b:1}, note:"Cut back after frost blackens the leaves; lift the rhizomes or mulch deeply.", list:1, sp:{
  "indica":{n:"Indian shot"},
  "x generalis":{n:"Canna lily"},
  "musifolia":{n:"Banana canna"}
}},
"Capsicum":{n:"Pepper", f:"Solanaceae", min:5, pat:"m", sp:{
  "annuum":{n:"Sweet pepper"},
  "chinense":{n:"Habanero pepper", min:8, pat:"m"}
}},
"Carex":{n:"Sedge", f:"Cyperaceae", min:-20, sp:{
  "oshimensis":{n:"Japanese sedge"},
  "buchananii":{n:"Leatherleaf sedge", min:-15}
}},
"Carica":{min:10, pat:"i"},
"Carpinus":{n:"Hornbeam", f:"Betulaceae", min:-30, sp:{
  "betulus":{n:"Hornbeam"}
}},
"Castanea":{min:-25},
"Catalpa":{n:"Catalpa", f:"Bignoniaceae", min:-25, sp:{
  "bignonioides":{n:"Indian bean tree"}
}},
"Ceanothus":{n:"California lilac", f:"Rhamnaceae", min:-10, sp:{
  "thyrsiflorus":{n:"Blueblossom"}
}},
"Cedrus":{n:"Cedar", f:"Pinaceae", min:-20, sp:{
  "atlantica":{n:"Atlas cedar"},
  "deodara":{n:"Deodar cedar", min:-18},
  "libani":{n:"Cedar of Lebanon", min:-25}
}},
"Centaurea":{n:"Cornflower", f:"Asteraceae", min:-20, sp:{
  "cyanus":{n:"Cornflower", min:-15},
  "montana":{n:"Perennial cornflower"}
}},
"Ceratostigma":{n:"Plumbago", f:"Plumbaginaceae", min:-15, sp:{
  "willmottianum":{n:"Chinese plumbago"}
}},
"Cercis":{n:"Redbud", f:"Fabaceae", min:-20, sp:{
  "siliquastrum":{n:"Judas tree", min:-15},
  "canadensis":{n:"Eastern redbud", min:-25}
}},
"Cereus":{n:"Column cactus", f:"Cactaceae", min:-2, pat:"m", t:{d:1}, sp:{
  "peruvianus":{n:"Peruvian apple cactus"}
}},
"Ceropegia":{min:7, pat:"i"},
"Cestrum":{n:"Jessamine", f:"Solanaceae", min:-5, sp:{
  "nocturnum":{n:"Night-blooming jasmine", min:-3, pat:"m"},
  "elegans":{n:"Purple cestrum"}
}},
"Chaenomeles":{n:"Flowering quince", f:"Rosaceae", min:-25, sp:{
  "japonica":{n:"Japanese quince"}
}},
"Chamaedorea":{n:"Parlour palm", f:"Arecaceae", min:10, pat:"i", sp:{
  "elegans":{n:"Parlour palm"},
  "radicalis":{n:"Radicalis palm", min:-4, pat:"m"}
}},
"Chamaerops":{n:"Fan palm", f:"Arecaceae", min:-10, ws:10, ww:30, t:{w:1}, sp:{
  "humilis":{n:"Mediterranean fan palm", min:-10, pat:"o", ws:10, ww:30, note:"Hardy fan palm. Dislikes wet roots in pots over winter.", list:1}
}},
"Chlorophytum":{n:"Spider plant", f:"Asparagaceae", min:5, pat:"i", sp:{
  "comosum":{n:"Spider plant"}
}},
"Choisya":{n:"Mexican orange", f:"Rutaceae", min:-12, sp:{
  "ternata":{n:"Mexican orange blossom"}
}},
"Chrysanthemum":{n:"Chrysanthemum", f:"Asteraceae", min:-15, sp:{
  "morifolium":{n:"Florist's chrysanthemum"}
}},
"Chusquea":{min:-12},
"Cissus":{min:7, pat:"i"},
"Cistus":{n:"Rock rose", f:"Cistaceae", min:-10, t:{d:1}, sp:{
  "x purpureus":{n:"Purple rock rose", min:-8},
  "ladanifer":{n:"Gum rock rose", min:-8}
}},
"Citrus":{n:"Citrus", f:"Rutaceae", min:-2, pat:"g", ws:4, ww:14, note:"Flowers and fruit are damaged before the tree is.", sp:{
  "limon":{n:"Lemon", min:-2, pat:"g", ws:4, ww:14, note:"Flowers and fruit are damaged before the tree is.", list:1},
  "sinensis":{n:"Orange", min:-3, pat:"g"},
  "reticulata":{n:"Mandarin", min:-4, pat:"g"},
  "aurantium":{n:"Bitter orange", min:-6, pat:"g"},
  "x meyeri":{n:"Meyer lemon", min:-3, pat:"g"},
  "japonica":{n:"Kumquat", min:-7, pat:"g"},
  "hystrix":{n:"Kaffir lime", min:2, pat:"g"},
  "aurantiifolia":{n:"Lime", min:2, pat:"g"}
}},
"Clematis":{n:"Clematis", f:"Ranunculaceae", min:-25, sp:{
  "montana":{n:"Mountain clematis", min:-20},
  "armandii":{n:"Evergreen clematis", min:-12},
  "viticella":{n:"Italian clematis"}
}},
"Clerodendrum":{min:-15},
"Clivia":{n:"Bush lily", f:"Amaryllidaceae", min:2, pat:"m", sp:{
  "miniata":{n:"Natal lily"}
}},
"Codiaeum":{min:13, pat:"i"},
"Coffea":{min:10, pat:"i"},
"Colocasia":{n:"Taro", f:"Araceae", min:2, pat:"m", ws:3, ww:14, t:{r:-5,b:1,d:3}, note:"Leaves collapse near 0 °C. Bring pots in, or cut back and mulch tubers heavily in the ground.", sp:{
  "esculenta":{n:"Taro", min:2, pat:"m", ws:3, ww:14, note:"Leaves collapse near 0 °C. Bring pots in, or cut back and mulch tubers heavily in the ground.", list:1},
  "fallax":{n:"Silver dollar taro", min:5, pat:"m"},
  "gigantea":{n:"Giant elephant ear", min:5, pat:"m"}
}},
"Columnea":{min:13, pat:"i"},
"Convallaria":{n:"Lily of the valley", f:"Asparagaceae", min:-30, sp:{
  "majalis":{n:"Lily of the valley"}
}},
"Convolvulus":{n:"Bindweed", f:"Convolvulaceae", min:-5, sp:{
  "cneorum":{n:"Silverbush", min:-8},
  "sabatius":{n:"Blue rock bindweed"}
}},
"Coprosma":{n:"Mirror bush", f:"Rubiaceae", min:-4, sp:{
  "repens":{n:"Mirror plant"}
}},
"Cordyline":{n:"Cabbage palm", f:"Asparagaceae", min:-6, ws:7, ww:30, t:{c:1}, sp:{
  "australis":{n:"Cabbage palm", min:-6, pat:"o", ws:7, ww:30, note:"Tie the leaves up around the growing point in a hard frost.", list:1},
  "fruticosa":{n:"Ti plant", min:10, pat:"i", t:{c:0}}
}},
"Coreopsis":{n:"Tickseed", f:"Asteraceae", min:-25, sp:{
  "verticillata":{n:"Threadleaf tickseed"}
}},
"Coriandrum":{min:-5},
"Cornus":{n:"Dogwood", f:"Cornaceae", min:-25, sp:{
  "alba":{n:"Red-barked dogwood", min:-35},
  "kousa":{n:"Kousa dogwood"},
  "florida":{n:"Flowering dogwood"}
}},
"Cortaderia":{n:"Pampas grass", f:"Poaceae", min:-15, sp:{
  "selloana":{n:"Pampas grass"}
}},
"Corylus":{n:"Hazel", f:"Betulaceae", min:-30, sp:{
  "avellana":{n:"Hazel"}
}},
"Cosmos":{n:"Cosmos", f:"Asteraceae", min:0, sp:{
  "bipinnatus":{n:"Garden cosmos"},
  "atrosanguineus":{n:"Chocolate cosmos", min:-5, pat:"m"}
}},
"Cotinus":{n:"Smoke bush", f:"Anacardiaceae", min:-25, sp:{
  "coggygria":{n:"Smoke bush"}
}},
"Cotoneaster":{n:"Cotoneaster", f:"Rosaceae", min:-25, sp:{
  "horizontalis":{n:"Wall cotoneaster"}
}},
"Crassula":{n:"Crassula", f:"Crassulaceae", min:2, pat:"m", t:{d:1}, sp:{
  "ovata":{n:"Jade plant"},
  "perforata":{n:"String of buttons"},
  "arborescens":{n:"Silver jade", min:0, pat:"m"}
}},
"Crinum":{n:"Crinum lily", f:"Amaryllidaceae", min:-12, sp:{
  "x powellii":{n:"Powell's crinum"}
}},
"Crocosmia":{n:"Montbretia", f:"Iridaceae", min:-15, sp:{
  "x crocosmiiflora":{n:"Montbretia"},
  "masoniorum":{n:"Giant montbretia"}
}},
"Crocus":{n:"Crocus", f:"Iridaceae", min:-30, sp:{
  "vernus":{n:"Spring crocus"},
  "sativus":{n:"Saffron crocus"}
}},
"Ctenanthe":{n:"Ctenanthe", f:"Marantaceae", min:13, pat:"i", sp:{
  "burle-marxii":{n:"Fishbone prayer plant"}
}},
"Cucumis":{n:"Cucumber", f:"Cucurbitaceae", min:5, sp:{
  "sativus":{n:"Cucumber"},
  "melo":{n:"Melon"}
}},
"Cucurbita":{n:"Squash", f:"Cucurbitaceae", min:3, sp:{
  "pepo":{n:"Courgette"},
  "maxima":{n:"Winter squash"}
}},
"Cupressus":{n:"Cypress", f:"Cupressaceae", min:-15, sp:{
  "sempervirens":{n:"Italian cypress"},
  "macrocarpa":{n:"Monterey cypress", min:-12}
}},
"Curcuma":{min:10, pat:"m"},
"Curio":{min:5, pat:"i", t:{d:1}},
"Cyathea":{min:0, pat:"g", t:{c:1,d:3}, sp:{
  "cooperi":{min:-2, pat:"g"},
  "dealbata":{min:-3, pat:"g"},
  "medullaris":{min:-2, pat:"g"}
}},
"Cycas":{n:"Sago palm", f:"Cycadaceae", min:-6, pat:"g", ws:10, ww:30, t:{c:1,w:1,d:1}, note:"Keep fairly dry in winter and protect the crown from wet and frost.", sp:{
  "revoluta":{n:"Sago palm", min:-6, pat:"g", ws:10, ww:30, note:"Keep fairly dry in winter and protect the crown from wet and frost.", list:1}
}},
"Cyclamen":{n:"Cyclamen", f:"Primulaceae", min:-15, sp:{
  "persicum":{n:"Florist's cyclamen", min:5, pat:"i"},
  "hederifolium":{n:"Ivy-leaved cyclamen", min:-20},
  "coum":{n:"Eastern cyclamen", min:-20}
}},
"Cydonia":{min:-25},
"Cylindropuntia":{min:-15, t:{d:1}},
"Cymbidium":{n:"Boat orchid", f:"Orchidaceae", min:3, pat:"m"},
"Cymbopogon":{min:5, pat:"m"},
"Cynara":{n:"Artichoke", f:"Asteraceae", min:-12, sp:{
  "cardunculus":{n:"Cardoon"},
  "scolymus":{n:"Globe artichoke"}
}},
"Cyperus":{n:"Papyrus", f:"Cyperaceae", min:0, pat:"m", t:{d:3}, sp:{
  "papyrus":{n:"Papyrus", min:5, pat:"m"},
  "alternifolius":{n:"Umbrella papyrus"}
}},
"Cyrtomium":{n:"Holly fern", f:"Dryopteridaceae", min:-15, sp:{
  "falcatum":{n:"Japanese holly fern"}
}},
"Dahlia":{n:"Dahlia", f:"Asteraceae", min:0, pat:"m", t:{r:-5}, note:"The top dies at the first frost. Lift the tubers, or mulch them deeply in dry ground.", sp:{
  "imperialis":{n:"Tree dahlia"},
  "pinnata":{n:"Garden dahlia"}
}},
"Daphne":{n:"Daphne", f:"Thymelaeaceae", min:-15, sp:{
  "odora":{n:"Winter daphne", min:-10}
}},
"Darmera":{min:-25, t:{d:3}},
"Dasylirion":{n:"Desert spoon", f:"Asparagaceae", min:-12, t:{w:1,d:1}, sp:{
  "wheeleri":{n:"Desert spoon"},
  "longissimum":{n:"Mexican grass tree", min:-10}
}},
"Datura":{n:"Thorn apple", f:"Solanaceae", min:0, pat:"m", sp:{
  "inoxia":{n:"Downy thorn apple"}
}},
"Daucus":{n:"Carrot", f:"Apiaceae", min:-10, sp:{
  "carota":{n:"Carrot"}
}},
"Davallia":{min:10, pat:"i"},
"Delosperma":{min:-20, t:{d:1}},
"Delphinium":{n:"Larkspur", f:"Ranunculaceae", min:-30, sp:{
  "elatum":{n:"Candle larkspur"}
}},
"Dendrobium":{n:"Dendrobium orchid", f:"Orchidaceae", min:10, pat:"i", sp:{
  "nobile":{n:"Noble dendrobium", min:5, pat:"m"}
}},
"Deutzia":{n:"Deutzia", f:"Hydrangeaceae", min:-25, sp:{
  "gracilis":{n:"Slender deutzia"}
}},
"Dianthus":{n:"Carnation", f:"Caryophyllaceae", min:-20, sp:{
  "caryophyllus":{n:"Carnation", min:-10},
  "barbatus":{n:"Sweet William"},
  "plumarius":{n:"Garden pink"}
}},
"Dicentra":{n:"Bleeding heart", f:"Papaveraceae", min:-30, sp:{
  "spectabilis":{n:"Bleeding heart"}
}},
"Dicksonia":{n:"Tree fern", f:"Dicksoniaceae", min:-5, pat:"o", ws:3, ww:10, t:{c:1,d:3}, note:"Water the trunk, not just the soil. Stuff the crown with straw or cover it with fleece in hard frost.", sp:{
  "antarctica":{n:"Soft tree fern", min:-5, pat:"o", ws:3, ww:10, note:"Water the trunk, not just the soil. Stuff the crown with straw or cover it with fleece below −5 °C.", list:1},
  "squarrosa":{n:"Rough tree fern", min:-3, pat:"g"},
  "fibrosa":{n:"Golden tree fern", min:-7}
}},
"Dieffenbachia":{n:"Dumb cane", f:"Araceae", min:15, pat:"i", sp:{
  "seguine":{n:"Dumb cane"}
}},
"Digitalis":{n:"Foxglove", f:"Plantaginaceae", min:-25, sp:{
  "purpurea":{n:"Foxglove"}
}},
"Dionaea":{n:"Venus flytrap", f:"Droseraceae", min:-8, t:{d:3}, sp:{
  "muscipula":{n:"Venus flytrap"}
}},
"Diospyros":{min:-15},
"Dracaena":{n:"Dragon tree", f:"Asparagaceae", min:12, pat:"i", sp:{
  "marginata":{n:"Madagascar dragon tree"},
  "fragrans":{n:"Corn plant"},
  "draco":{n:"Dragon tree", min:0, pat:"m"},
  "trifasciata":{n:"Snake plant", min:10, pat:"i", t:{d:1}},
  "sanderiana":{n:"Lucky bamboo", min:15, pat:"i"}
}},
"Drosera":{n:"Sundew", f:"Droseraceae", min:0, pat:"m", t:{d:3}, sp:{
  "capensis":{n:"Cape sundew"}
}},
"Dryopteris":{n:"Wood fern", f:"Dryopteridaceae", min:-30, sp:{
  "filix-mas":{n:"Male fern"},
  "erythrosora":{n:"Autumn fern", min:-25}
}},
"Dypsis":{min:5, pat:"i", sp:{
  "lutescens":{min:10, pat:"i"},
  "decaryi":{min:0, pat:"m"}
}},
"Echeveria":{n:"Echeveria", f:"Crassulaceae", min:2, pat:"m", t:{w:1,d:1}, sp:{
  "elegans":{n:"Mexican snowball", min:0, pat:"m"},
  "agavoides":{n:"Molded wax agave", min:0, pat:"m"}
}},
"Echinacea":{n:"Coneflower", f:"Asteraceae", min:-30, sp:{
  "purpurea":{n:"Purple coneflower"}
}},
"Echinocactus":{n:"Barrel cactus", f:"Cactaceae", min:5, pat:"m", t:{d:1}, sp:{
  "grusonii":{n:"Golden barrel cactus"}
}},
"Echinops":{n:"Globe thistle", f:"Asteraceae", min:-30, sp:{
  "ritro":{n:"Globe thistle"}
}},
"Echinopsis":{min:0, pat:"m", t:{d:1}},
"Echium":{n:"Echium", f:"Boraginaceae", min:-3, pat:"g", t:{c:1}, sp:{
  "candicans":{n:"Pride of Madeira"},
  "pininana":{n:"Giant viper's bugloss"},
  "wildpretii":{n:"Tower of jewels", min:-5, pat:"g"}
}},
"Edgeworthia":{min:-12},
"Elaeagnus":{n:"Oleaster", f:"Elaeagnaceae", min:-20, sp:{
  "x ebbingei":{n:"Ebbinge's silverberry"}
}},
"Ensete":{n:"Abyssinian banana", f:"Musaceae", min:1, pat:"m", ws:4, ww:14, t:{b:1,d:3}, note:"Tender. Bring inside or lift before the first frost.", sp:{
  "ventricosum":{n:"Abyssinian banana", min:1, pat:"m", ws:4, ww:14, note:"Tender. Bring inside or lift before the first frost.", list:1},
  "glaucum":{n:"Snow banana", min:3, pat:"m"}
}},
"Epimedium":{n:"Barrenwort", f:"Berberidaceae", min:-25, sp:{
  "x rubrum":{n:"Red barrenwort"}
}},
"Epipremnum":{n:"Pothos", f:"Araceae", min:12, pat:"i", sp:{
  "aureum":{n:"Golden pothos"},
  "pinnatum":{n:"Dragon tail plant"}
}},
"Equisetum":{n:"Horsetail", f:"Equisetaceae", min:-30, t:{d:3}, sp:{
  "hyemale":{n:"Rough horsetail"}
}},
"Erica":{n:"Heath", f:"Ericaceae", min:-20, sp:{
  "carnea":{n:"Winter heath", min:-30},
  "arborea":{n:"Tree heath", min:-12}
}},
"Erigeron":{n:"Fleabane", f:"Asteraceae", min:-15, sp:{
  "karvinskianus":{n:"Mexican fleabane"}
}},
"Eriobotrya":{n:"Loquat", f:"Rosaceae", min:-12, pat:"o", note:"The tree is hardy, but winter flowers and young fruit are lost below about −3 °C.", sp:{
  "japonica":{n:"Loquat"}
}},
"Eryngium":{n:"Sea holly", f:"Apiaceae", min:-20, sp:{
  "planum":{n:"Flat sea holly"},
  "agavifolium":{n:"Agave-leaved sea holly", min:-12}
}},
"Erysimum":{n:"Wallflower", f:"Brassicaceae", min:-15, sp:{
  "cheiri":{n:"Wallflower"},
  "linifolium":{n:"Bowles's mauve"}
}},
"Escallonia":{n:"Escallonia", f:"Escalloniaceae", min:-10, sp:{
  "rubra":{n:"Red escallonia"}
}},
"Eucalyptus":{n:"Eucalyptus", f:"Myrtaceae", min:-10, sp:{
  "gunnii":{n:"Cider gum", min:-15},
  "globulus":{n:"Tasmanian blue gum", min:-7}
}},
"Eucomis":{n:"Pineapple lily", f:"Asparagaceae", min:-10, sp:{
  "bicolor":{n:"Pineapple lily"}
}},
"Euonymus":{n:"Spindle", f:"Celastraceae", min:-20, sp:{
  "japonicus":{n:"Japanese spindle", min:-15},
  "fortunei":{n:"Wintercreeper", min:-25}
}},
"Euphorbia":{n:"Spurge", f:"Euphorbiaceae", min:5, pat:"m", sp:{
  "pulcherrima":{n:"Poinsettia", min:10, pat:"i"},
  "milii":{n:"Crown of thorns", min:8, pat:"i"},
  "characias":{n:"Mediterranean spurge", min:-15},
  "trigona":{n:"African milk tree", min:10, pat:"i"},
  "tirucalli":{n:"Pencil cactus", min:5, pat:"m"},
  "mellifera":{n:"Honey spurge", min:-7}
}},
"Farfugium":{min:-12},
"Fargesia":{n:"Umbrella bamboo", f:"Poaceae", min:-25, sp:{
  "murielae":{n:"Umbrella bamboo"},
  "rufa":{n:"Chinese fountain bamboo"}
}},
"Fascicularia":{n:"Fascicularia", f:"Bromeliaceae", min:-10, sp:{
  "bicolor":{n:"Crimson bromeliad"}
}},
"Fatshedera":{min:-12},
"Fatsia":{n:"Japanese aralia", f:"Araliaceae", min:-12, pat:"o", ws:7, ww:21, note:"Very hardy. Keep pots from freezing solid.", sp:{
  "japonica":{n:"Japanese aralia", min:-12, pat:"o", ws:7, ww:21, note:"Very hardy. Keep pots from freezing solid.", list:1},
  "polycarpa":{n:"Taiwanese fatsia"}
}},
"Feijoa":{n:"Pineapple guava", f:"Myrtaceae", min:-12, sp:{
  "sellowiana":{n:"Pineapple guava"}
}},
"Festuca":{n:"Fescue", f:"Poaceae", min:-30, sp:{
  "glauca":{n:"Blue fescue"}
}},
"Ficus":{n:"Fig", f:"Moraceae", min:10, pat:"i", ws:7, ww:14, sp:{
  "carica":{n:"Common fig", min:-12, pat:"o", t:{s:-2}, note:"Young shoots die back in hard frost; established trees regrow."},
  "lyrata":{n:"Fiddle-leaf fig", min:12, pat:"i", ws:7, ww:14, list:1},
  "elastica":{n:"Rubber plant", min:5, pat:"i"},
  "benjamina":{n:"Weeping fig"},
  "pumila":{n:"Creeping fig", min:-5, pat:"m"},
  "microcarpa":{n:"Chinese banyan", min:5, pat:"i"}
}},
"Fittonia":{n:"Nerve plant", f:"Acanthaceae", min:15, pat:"i", sp:{
  "albivenis":{n:"Nerve plant"}
}},
"Forsythia":{n:"Forsythia", f:"Oleaceae", min:-25, sp:{
  "x intermedia":{n:"Border forsythia"}
}},
"Fortunella":{min:-7, pat:"g"},
"Fragaria":{n:"Strawberry", f:"Rosaceae", min:-20, sp:{
  "x ananassa":{n:"Garden strawberry"},
  "vesca":{n:"Wild strawberry"}
}},
"Freesia":{n:"Freesia", f:"Iridaceae", min:0, pat:"m"},
"Fuchsia":{n:"Fuchsia", f:"Onagraceae", min:0, pat:"m", sp:{
  "magellanica":{n:"Hardy fuchsia", min:-15}
}},
"Gaillardia":{n:"Blanket flower", f:"Asteraceae", min:-25, sp:{
  "x grandiflora":{n:"Blanket flower"}
}},
"Galanthus":{n:"Snowdrop", f:"Amaryllidaceae", min:-30, sp:{
  "nivalis":{n:"Common snowdrop"}
}},
"Gardenia":{n:"Gardenia", f:"Rubiaceae", min:5, pat:"i", sp:{
  "jasminoides":{n:"Cape jasmine"}
}},
"Gasteria":{min:3, pat:"m", t:{d:1}},
"Gaura":{n:"Gaura", f:"Onagraceae", min:-15, sp:{
  "lindheimeri":{n:"White gaura"}
}},
"Gazania":{n:"Treasure flower", f:"Asteraceae", min:-3, pat:"m", sp:{
  "rigens":{n:"Treasure flower"}
}},
"Geranium":{n:"Cranesbill", f:"Geraniaceae", min:-25, sp:{
  "macrorrhizum":{n:"Bigroot cranesbill"},
  "sanguineum":{n:"Bloody cranesbill"},
  "maderense":{n:"Madeira cranesbill", min:-2, pat:"m"}
}},
"Gerbera":{n:"Gerbera", f:"Asteraceae", min:0, pat:"m", sp:{
  "jamesonii":{n:"Barberton daisy"}
}},
"Ginkgo":{n:"Ginkgo", f:"Ginkgoaceae", min:-30, sp:{
  "biloba":{n:"Maidenhair tree"}
}},
"Gladiolus":{n:"Gladiolus", f:"Iridaceae", min:-5, sp:{
  "communis":{n:"Common gladiolus", min:-15}
}},
"Goeppertia":{min:15, pat:"i", t:{d:3}},
"Grevillea":{min:-8, sp:{
  "rosmarinifolia":{min:-12}
}},
"Gunnera":{n:"Gunnera", f:"Gunneraceae", min:-10, pat:"o", t:{c:1,b:1,d:3}, note:"Leaves die at the first frost. Fold them over the crown and add straw before winter.", sp:{
  "manicata":{n:"Giant rhubarb"},
  "tinctoria":{n:"Chilean rhubarb", min:-10}
}},
"Guzmania":{n:"Guzmania", f:"Bromeliaceae", min:12, pat:"i", sp:{
  "lingulata":{n:"Scarlet star"}
}},
"Gymnocalycium":{min:0, pat:"m", t:{d:1}},
"Gynura":{min:12, pat:"i"},
"Hakonechloa":{n:"Japanese forest grass", f:"Poaceae", min:-25, sp:{
  "macra":{n:"Japanese forest grass"}
}},
"Hamamelis":{n:"Witch hazel", f:"Hamamelidaceae", min:-25, sp:{
  "x intermedia":{n:"Hybrid witch hazel"},
  "mollis":{n:"Chinese witch hazel"}
}},
"Haworthia":{n:"Haworthia", f:"Asphodelaceae", min:5, pat:"i", t:{d:1}, sp:{
  "attenuata":{n:"Zebra haworthia"},
  "cooperi":{n:"Cooper's haworthia"}
}},
"Haworthiopsis":{min:5, pat:"i", t:{d:1}},
"Hebe":{n:"Hebe", f:"Plantaginaceae", min:-10, sp:{
  "pinguifolia":{n:"Disc-leaved hebe", min:-15},
  "x franciscana":{n:"Hebe", min:-7}
}},
"Hedera":{n:"Ivy", f:"Araliaceae", min:-20, sp:{
  "helix":{n:"Common ivy"},
  "colchica":{n:"Persian ivy"}
}},
"Hedychium":{n:"Ginger lily", f:"Zingiberaceae", min:-5, pat:"o", ws:4, ww:30, t:{b:1}, note:"Dies back in winter; mulch the rhizomes.", list:1, sp:{
  "gardnerianum":{n:"Kahili ginger", min:-3},
  "coccineum":{n:"Scarlet ginger lily", min:-8},
  "densiflorum":{n:"Dense ginger lily", min:-12},
  "coronarium":{n:"White ginger lily", min:-3},
  "forrestii":{n:"Forrest's ginger lily", min:-10}
}},
"Helianthus":{n:"Sunflower", f:"Asteraceae", min:0, sp:{
  "annuus":{n:"Sunflower"}
}},
"Helichrysum":{n:"Curry plant", f:"Asteraceae", min:-15, sp:{
  "italicum":{n:"Curry plant"},
  "petiolare":{n:"Licorice plant", min:-2, pat:"m"}
}},
"Heliconia":{min:12, pat:"i"},
"Helleborus":{n:"Hellebore", f:"Ranunculaceae", min:-25, sp:{
  "niger":{n:"Christmas rose"},
  "x hybridus":{n:"Lenten rose"},
  "argutifolius":{n:"Corsican hellebore", min:-15}
}},
"Hemerocallis":{n:"Daylily", f:"Asphodelaceae", min:-30, sp:{
  "fulva":{n:"Orange daylily"}
}},
"Hesperaloe":{min:-18, t:{w:1,d:1}},
"Hesperoyucca":{min:-10},
"Heuchera":{n:"Coral bells", f:"Saxifragaceae", min:-30, sp:{
  "micrantha":{n:"Coral bells"}
}},
"Hibiscus":{n:"Hibiscus", f:"Malvaceae", min:-20, ws:3, ww:10, sp:{
  "rosa-sinensis":{n:"Chinese hibiscus", min:7, pat:"m", ws:3, ww:10, list:1},
  "syriacus":{n:"Rose of Sharon", min:-25},
  "moscheutos":{n:"Swamp rose mallow", min:-25}
}},
"Hippeastrum":{n:"Amaryllis", f:"Amaryllidaceae", min:5, pat:"i", sp:{
  "x hybridum":{n:"Amaryllis"}
}},
"Hosta":{n:"Hosta", f:"Asparagaceae", min:-35, t:{s:-1}, sp:{
  "sieboldiana":{n:"Siebold's plantain lily"},
  "plantaginea":{n:"August lily"}
}},
"Howea":{min:5, pat:"i"},
"Hoya":{n:"Wax plant", f:"Apocynaceae", min:10, pat:"i", sp:{
  "carnosa":{n:"Wax plant"},
  "kerrii":{n:"Sweetheart plant"},
  "linearis":{n:"Linear-leaved hoya"}
}},
"Hyacinthus":{n:"Hyacinth", f:"Asparagaceae", min:-25, sp:{
  "orientalis":{n:"Garden hyacinth"}
}},
"Hydrangea":{n:"Hydrangea", f:"Hydrangeaceae", min:-20, t:{d:3}, sp:{
  "macrophylla":{n:"Bigleaf hydrangea", min:-15, pat:"o", t:{s:-2}, note:"Hardy, but late frost kills the flower buds."},
  "paniculata":{n:"Panicle hydrangea", min:-30},
  "quercifolia":{n:"Oakleaf hydrangea", min:-25},
  "petiolaris":{n:"Climbing hydrangea", min:-30},
  "arborescens":{n:"Smooth hydrangea", min:-30},
  "aspera":{n:"Rough-leaved hydrangea", min:-15}
}},
"Hypericum":{n:"St John's wort", f:"Hypericaceae", min:-20, sp:{
  "calycinum":{n:"Rose of Sharon"}
}},
"Hypoestes":{min:10, pat:"i"},
"Iberis":{n:"Candytuft", f:"Brassicaceae", min:-25, sp:{
  "sempervirens":{n:"Perennial candytuft"}
}},
"Ilex":{n:"Holly", f:"Aquifoliaceae", min:-20, sp:{
  "aquifolium":{n:"English holly"},
  "crenata":{n:"Japanese holly"}
}},
"Impatiens":{n:"Busy lizzie", f:"Balsaminaceae", min:5, pat:"m", t:{d:3}, sp:{
  "walleriana":{n:"Busy lizzie"},
  "hawkeri":{n:"New Guinea impatiens"},
  "tinctoria":{n:"Hardy impatiens", min:-10}
}},
"Iris":{n:"Iris", f:"Iridaceae", min:-25, sp:{
  "germanica":{n:"Bearded iris"},
  "sibirica":{n:"Siberian iris"},
  "pseudacorus":{n:"Yellow flag"}
}},
"Jasminum":{n:"Jasmine", f:"Oleaceae", min:-10, sp:{
  "officinale":{n:"Common jasmine", min:-12},
  "polyanthum":{n:"Pink jasmine", min:-3, pat:"m"},
  "nudiflorum":{n:"Winter jasmine", min:-20},
  "sambac":{n:"Arabian jasmine", min:7, pat:"i"}
}},
"Jubaea":{min:-12, t:{c:1}},
"Juglans":{min:-25, t:{s:-1}},
"Juncus":{min:-25, t:{d:3}},
"Juniperus":{n:"Juniper", f:"Cupressaceae", min:-30, sp:{
  "communis":{n:"Common juniper"},
  "horizontalis":{n:"Creeping juniper"}
}},
"Kalanchoe":{n:"Kalanchoe", f:"Crassulaceae", min:7, pat:"i", t:{d:1}, sp:{
  "blossfeldiana":{n:"Flaming Katy"},
  "daigremontiana":{n:"Mother of thousands"},
  "tomentosa":{n:"Panda plant"},
  "thyrsiflora":{n:"Paddle plant", min:5, pat:"i"}
}},
"Kalopanax":{min:-25},
"Kniphofia":{n:"Red hot poker", f:"Asphodelaceae", min:-15, sp:{
  "uvaria":{n:"Red hot poker"},
  "caulescens":{n:"Tree poker", min:-12}
}},
"Lactuca":{min:-5},
"Lagerstroemia":{n:"Crape myrtle", f:"Lythraceae", min:-15, sp:{
  "indica":{n:"Crape myrtle"}
}},
"Lantana":{n:"Lantana", f:"Verbenaceae", min:0, pat:"m", sp:{
  "camara":{n:"Common lantana"}
}},
"Laurus":{n:"Bay", f:"Lauraceae", min:-12, sp:{
  "nobilis":{n:"Bay laurel"}
}},
"Lavandula":{n:"Lavender", f:"Lamiaceae", min:-15, t:{d:1}, sp:{
  "angustifolia":{n:"English lavender", min:-20},
  "stoechas":{n:"French lavender", min:-8},
  "x intermedia":{n:"Lavandin", min:-18},
  "dentata":{n:"Fringed lavender", min:-5, pat:"m"}
}},
"Leucadendron":{min:-3, pat:"g"},
"Leucanthemum":{n:"Shasta daisy", f:"Asteraceae", min:-30, sp:{
  "x superbum":{n:"Shasta daisy"},
  "vulgare":{n:"Oxeye daisy"}
}},
"Levisticum":{min:-30},
"Ligularia":{n:"Leopard plant", f:"Asteraceae", min:-30, t:{d:3}, sp:{
  "dentata":{n:"Summer ragwort"},
  "przewalskii":{n:"Przewalski's leopard plant"}
}},
"Ligustrum":{n:"Privet", f:"Oleaceae", min:-15, sp:{
  "japonicum":{n:"Japanese privet"},
  "lucidum":{n:"Glossy privet"}
}},
"Lilium":{n:"Lily", f:"Liliaceae", min:-25, sp:{
  "regale":{n:"Regal lily"},
  "candidum":{n:"Madonna lily", min:-20},
  "lancifolium":{n:"Tiger lily"}
}},
"Liquidambar":{n:"Sweetgum", f:"Altingiaceae", min:-25, sp:{
  "styraciflua":{n:"Sweetgum"}
}},
"Liriodendron":{n:"Tulip tree", f:"Magnoliaceae", min:-30, sp:{
  "tulipifera":{n:"Tulip tree"}
}},
"Liriope":{n:"Lilyturf", f:"Asparagaceae", min:-20, sp:{
  "muscari":{n:"Big blue lilyturf"}
}},
"Lithops":{n:"Living stones", f:"Aizoaceae", min:5, pat:"i", t:{d:1}},
"Livistona":{min:-4, pat:"m", t:{c:1}, sp:{
  "chinensis":{min:-5, pat:"o"},
  "australis":{min:-6}
}},
"Lobelia":{n:"Lobelia", f:"Campanulaceae", min:-20, sp:{
  "erinus":{n:"Trailing lobelia", min:0},
  "cardinalis":{n:"Cardinal flower"},
  "tupa":{n:"Devil's tobacco", min:-8}
}},
"Lonicera":{n:"Honeysuckle", f:"Caprifoliaceae", min:-25, sp:{
  "periclymenum":{n:"Common honeysuckle"},
  "japonica":{n:"Japanese honeysuckle", min:-20},
  "nitida":{n:"Box honeysuckle", min:-20}
}},
"Lupinus":{n:"Lupin", f:"Fabaceae", min:-30, sp:{
  "polyphyllus":{n:"Garden lupin"}
}},
"Lysichiton":{min:-25, t:{d:3}},
"Magnolia":{n:"Magnolia", f:"Magnoliaceae", min:-20, sp:{
  "grandiflora":{n:"Southern magnolia", min:-15},
  "stellata":{n:"Star magnolia", min:-25},
  "x soulangeana":{n:"Saucer magnolia", min:-25},
  "liliiflora":{n:"Lily magnolia", min:-25},
  "kobus":{n:"Kobus magnolia", min:-25}
}},
"Mahonia":{n:"Mahonia", f:"Berberidaceae", min:-15, sp:{
  "aquifolium":{n:"Oregon grape", min:-25},
  "japonica":{n:"Japanese mahonia"},
  "x media":{n:"Mahonia"},
  "eurybracteata":{n:"Soft caress mahonia", min:-12}
}},
"Malus":{n:"Apple", f:"Rosaceae", min:-30, sp:{
  "domestica":{n:"Apple"},
  "sylvestris":{n:"Crab apple"}
}},
"Malva":{n:"Mallow", f:"Malvaceae", min:-20, sp:{
  "sylvestris":{n:"Common mallow"}
}},
"Mammillaria":{min:3, pat:"m", t:{d:1}},
"Mandevilla":{n:"Mandevilla", f:"Apocynaceae", min:7, pat:"m", sp:{
  "sanderi":{n:"Brazilian jasmine"},
  "laxa":{n:"Chilean jasmine", min:-5}
}},
"Mangifera":{min:5, pat:"g"},
"Maranta":{n:"Prayer plant", f:"Marantaceae", min:15, pat:"i", t:{d:3}, sp:{
  "leuconeura":{n:"Prayer plant"}
}},
"Matteuccia":{n:"Ostrich fern", f:"Onocleaceae", min:-35, sp:{
  "struthiopteris":{n:"Ostrich fern"}
}},
"Melianthus":{n:"Honey bush", f:"Francoaceae", min:-5, pat:"o", t:{r:-10}, note:"The top dies back around −5 °C; mulched roots survive about −10 °C and regrow.", sp:{
  "major":{n:"Giant honey flower"}
}},
"Melissa":{n:"Lemon balm", f:"Lamiaceae", min:-20, sp:{
  "officinalis":{n:"Lemon balm"}
}},
"Mentha":{n:"Mint", f:"Lamiaceae", min:-25, sp:{
  "spicata":{n:"Spearmint"},
  "x piperita":{n:"Peppermint"},
  "suaveolens":{n:"Apple mint"}
}},
"Mespilus":{min:-20},
"Metasequoia":{n:"Dawn redwood", f:"Cupressaceae", min:-30, sp:{
  "glyptostroboides":{n:"Dawn redwood"}
}},
"Miscanthus":{n:"Silver grass", f:"Poaceae", min:-25, sp:{
  "sinensis":{n:"Chinese silver grass"}
}},
"Monstera":{n:"Monstera", f:"Araceae", min:12, pat:"i", ws:7, ww:14, sp:{
  "deliciosa":{n:"Swiss cheese plant", min:12, pat:"i", ws:7, ww:14, list:1},
  "adansonii":{n:"Swiss cheese vine", min:13, pat:"i"},
  "obliqua":{n:"Monstera obliqua", min:15, pat:"i"}
}},
"Morus":{min:-25},
"Musa":{n:"Banana", f:"Musaceae", min:5, pat:"m", ws:4, ww:21, t:{b:1,d:3}, sp:{
  "basjoo":{n:"Japanese banana", min:-3, pat:"o", ws:4, ww:21, t:{r:-10}, note:"The trunk is damaged around −3 °C; the roots survive to about −10 °C under thick mulch. Wrap the trunk or cut it back and mulch before hard frost.", list:1},
  "acuminata":{n:"Dwarf banana", min:5, pat:"m"},
  "sikkimensis":{n:"Darjeeling banana", min:-2, pat:"o", t:{r:-8}, note:"Like Musa basjoo: wrap or cut back the trunk and mulch the roots."},
  "x paradisiaca":{n:"Plantain", min:5, pat:"m"},
  "velutina":{n:"Pink banana", min:0, pat:"m"},
  "itinerans":{n:"Yunnan banana", min:-1, pat:"m"},
  "balbisiana":{n:"Wild banana", min:2, pat:"m"}
}},
"Muscari":{n:"Grape hyacinth", f:"Asparagaceae", min:-30, sp:{
  "armeniacum":{n:"Grape hyacinth"}
}},
"Musella":{min:-5, pat:"o", t:{r:-10,b:1}, note:"Roots survive about −10 °C under thick mulch."},
"Myosotis":{n:"Forget-me-not", f:"Boraginaceae", min:-25, sp:{
  "sylvatica":{n:"Wood forget-me-not"}
}},
"Myrtus":{n:"Myrtle", f:"Myrtaceae", min:-10, sp:{
  "communis":{n:"Common myrtle"}
}},
"Nandina":{n:"Heavenly bamboo", f:"Berberidaceae", min:-15, sp:{
  "domestica":{n:"Heavenly bamboo"}
}},
"Narcissus":{n:"Daffodil", f:"Amaryllidaceae", min:-30, sp:{
  "pseudonarcissus":{n:"Wild daffodil"},
  "tazetta":{n:"Paperwhite", min:-10}
}},
"Nelumbo":{min:-10, pat:"o", note:"Survives if the tubers sit below the ice."},
"Nepenthes":{n:"Pitcher plant", f:"Nepenthaceae", min:12, pat:"i", t:{d:3}},
"Nepeta":{n:"Catmint", f:"Lamiaceae", min:-30, sp:{
  "x faassenii":{n:"Catmint"},
  "cataria":{n:"Catnip"}
}},
"Nephrolepis":{n:"Boston fern", f:"Nephrolepidaceae", min:10, pat:"i", t:{d:3}, sp:{
  "exaltata":{n:"Boston fern"}
}},
"Nerium":{n:"Oleander", f:"Apocynaceae", min:-5, pat:"g", ws:5, ww:21, sp:{
  "oleander":{n:"Oleander", min:-5, pat:"g", ws:5, ww:21, list:1}
}},
"Nicotiana":{n:"Tobacco plant", f:"Solanaceae", min:0, sp:{
  "alata":{n:"Jasmine tobacco"},
  "sylvestris":{n:"Woodland tobacco", min:-5}
}},
"Nolina":{min:-12, t:{d:1}},
"Nymphaea":{min:-30},
"Ocimum":{n:"Basil", f:"Lamiaceae", min:8, pat:"m", sp:{
  "basilicum":{n:"Sweet basil"}
}},
"Olea":{n:"Olive", f:"Oleaceae", min:-8, ws:10, ww:30, sp:{
  "europaea":{n:"Olive", min:-8, pat:"o", ws:10, ww:30, list:1}
}},
"Opuntia":{n:"Prickly pear", f:"Cactaceae", min:-5, t:{w:1,d:1}, sp:{
  "ficus-indica":{n:"Indian fig", min:-5},
  "microdasys":{n:"Bunny ears cactus", min:0, pat:"m"},
  "humifusa":{n:"Eastern prickly pear", min:-25}
}},
"Origanum":{n:"Oregano", f:"Lamiaceae", min:-20, sp:{
  "vulgare":{n:"Oregano"},
  "majorana":{n:"Marjoram", min:-5}
}},
"Osmanthus":{n:"Osmanthus", f:"Oleaceae", min:-15, sp:{
  "fragrans":{n:"Sweet osmanthus", min:-8},
  "x burkwoodii":{n:"Burkwood osmanthus", min:-20}
}},
"Osmunda":{min:-30},
"Osteospermum":{n:"African daisy", f:"Asteraceae", min:-5, sp:{
  "ecklonis":{n:"Cape daisy"}
}},
"Oxalis":{n:"Wood sorrel", f:"Oxalidaceae", min:-10, sp:{
  "triangularis":{n:"False shamrock", min:0, pat:"m"}
}},
"Pachira":{min:10, pat:"i"},
"Pachysandra":{n:"Pachysandra", f:"Buxaceae", min:-30, sp:{
  "terminalis":{n:"Japanese spurge"}
}},
"Paeonia":{n:"Peony", f:"Paeoniaceae", min:-30, sp:{
  "lactiflora":{n:"Chinese peony"},
  "suffruticosa":{n:"Tree peony"}
}},
"Papaver":{n:"Poppy", f:"Papaveraceae", min:-30, sp:{
  "orientale":{n:"Oriental poppy"},
  "rhoeas":{n:"Common poppy"}
}},
"Parthenocissus":{n:"Virginia creeper", f:"Vitaceae", min:-30, sp:{
  "quinquefolia":{n:"Virginia creeper"},
  "tricuspidata":{n:"Boston ivy"}
}},
"Passiflora":{n:"Passion flower", f:"Passifloraceae", min:0, pat:"g", sp:{
  "caerulea":{n:"Blue passion flower", min:-10, pat:"o", t:{r:-15}, note:"The top can die in hard frost and regrows from the roots."},
  "edulis":{n:"Passion fruit", min:0, pat:"g"}
}},
"Paulownia":{n:"Foxglove tree", f:"Paulowniaceae", min:-20, t:{b:1}, sp:{
  "tomentosa":{n:"Empress tree"}
}},
"Pelargonium":{n:"Geranium", f:"Geraniaceae", min:0, pat:"m", sp:{
  "x hortorum":{n:"Zonal geranium"},
  "peltatum":{n:"Ivy-leaved geranium"},
  "graveolens":{n:"Rose geranium"},
  "sidoides":{n:"South African geranium", min:-3, pat:"m"}
}},
"Pennisetum":{n:"Fountain grass", f:"Poaceae", min:-20, sp:{
  "alopecuroides":{n:"Chinese fountain grass"},
  "setaceum":{n:"Purple fountain grass", min:0, pat:"m"}
}},
"Penstemon":{n:"Beardtongue", f:"Plantaginaceae", min:-15, sp:{
  "digitalis":{n:"Foxglove beardtongue"}
}},
"Peperomia":{n:"Peperomia", f:"Piperaceae", min:10, pat:"i", sp:{
  "obtusifolia":{n:"Baby rubber plant"},
  "argyreia":{n:"Watermelon peperomia"},
  "caperata":{n:"Emerald ripple"},
  "polybotrya":{n:"Raindrop peperomia"}
}},
"Perovskia":{n:"Russian sage", f:"Lamiaceae", min:-25, sp:{
  "atriplicifolia":{n:"Russian sage"}
}},
"Persea":{n:"Avocado", f:"Lauraceae", min:-3, pat:"g", sp:{
  "americana":{n:"Avocado"}
}},
"Persicaria":{n:"Knotweed", f:"Polygonaceae", min:-30, sp:{
  "amplexicaulis":{n:"Red bistort"}
}},
"Petasites":{min:-25},
"Petroselinum":{n:"Parsley", f:"Apiaceae", min:-10, sp:{
  "crispum":{n:"Parsley"}
}},
"Petunia":{n:"Petunia", f:"Solanaceae", min:0, sp:{
  "x atkinsiana":{n:"Garden petunia"}
}},
"Phalaenopsis":{n:"Moth orchid", f:"Orchidaceae", min:15, pat:"i", sp:{
  "amabilis":{n:"Moth orchid"}
}},
"Phaseolus":{min:5},
"Philadelphus":{n:"Mock orange", f:"Hydrangeaceae", min:-30, sp:{
  "coronarius":{n:"Sweet mock orange"}
}},
"Philodendron":{n:"Philodendron", f:"Araceae", min:12, pat:"i", sp:{
  "hederaceum":{n:"Heartleaf philodendron"},
  "bipinnatifidum":{n:"Lacy tree philodendron", min:0, pat:"m"},
  "erubescens":{n:"Blushing philodendron"},
  "gloriosum":{n:"Velvet philodendron"},
  "birkin":{n:"Birkin philodendron"}
}},
"Phlomis":{n:"Jerusalem sage", f:"Lamiaceae", min:-15, sp:{
  "fruticosa":{n:"Jerusalem sage"},
  "russeliana":{n:"Turkish sage", min:-25}
}},
"Phlox":{n:"Phlox", f:"Polemoniaceae", min:-30, sp:{
  "paniculata":{n:"Garden phlox"},
  "subulata":{n:"Creeping phlox"}
}},
"Phoenix":{n:"Date palm", f:"Arecaceae", min:-5, t:{c:1}, sp:{
  "canariensis":{n:"Canary Island date palm", min:-7},
  "dactylifera":{n:"Date palm", min:-8},
  "roebelenii":{n:"Pygmy date palm", min:2, pat:"m"}
}},
"Phormium":{n:"New Zealand flax", f:"Asphodelaceae", min:-8, pat:"o", ws:7, ww:30, note:"Variegated forms are more tender.", list:1, sp:{
  "tenax":{n:"New Zealand flax"},
  "cookianum":{n:"Mountain flax", min:-8}
}},
"Photinia":{n:"Photinia", f:"Rosaceae", min:-18, sp:{
  "x fraseri":{n:"Red robin"}
}},
"Phyllostachys":{n:"Bamboo", f:"Poaceae", min:-20, sp:{
  "aurea":{n:"Golden bamboo"},
  "nigra":{n:"Black bamboo"},
  "edulis":{n:"Moso bamboo", min:-15},
  "bissetii":{n:"Bisset bamboo", min:-25},
  "vivax":{n:"Chinese timber bamboo", min:-25}
}},
"Picea":{n:"Spruce", f:"Pinaceae", min:-40, sp:{
  "abies":{n:"Norway spruce"},
  "pungens":{n:"Blue spruce"},
  "glauca":{n:"White spruce"}
}},
"Pieris":{n:"Pieris", f:"Ericaceae", min:-20, sp:{
  "japonica":{n:"Japanese andromeda"}
}},
"Pilea":{n:"Pilea", f:"Urticaceae", min:10, pat:"i", sp:{
  "peperomioides":{n:"Chinese money plant", min:5, pat:"i"},
  "cadierei":{n:"Aluminium plant"}
}},
"Pinus":{n:"Pine", f:"Pinaceae", min:-30, sp:{
  "pinea":{n:"Stone pine", min:-15},
  "mugo":{n:"Mountain pine"},
  "sylvestris":{n:"Scots pine"},
  "thunbergii":{n:"Japanese black pine", min:-25}
}},
"Pisum":{min:-5},
"Pittosporum":{n:"Pittosporum", f:"Pittosporaceae", min:-10, sp:{
  "tobira":{n:"Japanese cheesewood"},
  "tenuifolium":{n:"Kohuhu"}
}},
"Platanus":{n:"Plane", f:"Platanaceae", min:-25, sp:{
  "x hispanica":{n:"London plane"}
}},
"Platycerium":{n:"Staghorn fern", f:"Polypodiaceae", min:10, pat:"i", sp:{
  "bifurcatum":{n:"Staghorn fern"}
}},
"Plectranthus":{n:"Spurflower", f:"Lamiaceae", min:5, pat:"m", sp:{
  "scutellarioides":{n:"Coleus"},
  "verticillatus":{n:"Swedish ivy"}
}},
"Pleioblastus":{min:-20},
"Plumbago":{n:"Leadwort", f:"Plumbaginaceae", min:-2, pat:"m", sp:{
  "auriculata":{n:"Cape leadwort"}
}},
"Podocarpus":{n:"Podocarpus", f:"Podocarpaceae", min:-10, sp:{
  "macrophyllus":{n:"Buddhist pine", min:-12}
}},
"Polygonatum":{n:"Solomon's seal", f:"Asparagaceae", min:-30, sp:{
  "x hybridum":{n:"Solomon's seal"}
}},
"Polypodium":{min:-15},
"Polystichum":{n:"Shield fern", f:"Dryopteridaceae", min:-25, sp:{
  "setiferum":{n:"Soft shield fern"},
  "polyblepharum":{n:"Japanese tassel fern", min:-20}
}},
"Pontederia":{min:-20, t:{d:3}},
"Primula":{n:"Primrose", f:"Primulaceae", min:-25, sp:{
  "vulgaris":{n:"Primrose"},
  "veris":{n:"Cowslip"},
  "obconica":{n:"German primrose", min:5, pat:"i"}
}},
"Protea":{min:-3, pat:"g"},
"Prunus":{n:"Cherry", f:"Rosaceae", min:-25, sp:{
  "avium":{n:"Wild cherry", min:-30},
  "persica":{n:"Peach", min:-20, pat:"o", t:{s:-2}, note:"Blossom is killed by frost below about −2 °C."},
  "domestica":{n:"Plum", min:-30},
  "armeniaca":{n:"Apricot", min:-20, pat:"o", t:{s:-2}, note:"Blossom is killed by frost below about −2 °C."},
  "dulcis":{n:"Almond", min:-15, pat:"o", t:{s:-2}, note:"Blossom is killed by frost below about −2 °C."},
  "laurocerasus":{n:"Cherry laurel", min:-20},
  "lusitanica":{n:"Portugal laurel", min:-15},
  "serrulata":{n:"Japanese cherry"}
}},
"Pseudopanax":{n:"Lancewood", f:"Araliaceae", min:-7, sp:{
  "crassifolius":{n:"Lancewood"},
  "lessonii":{n:"Houpara", min:-5}
}},
"Psidium":{min:0, pat:"g"},
"Pulmonaria":{n:"Lungwort", f:"Boraginaceae", min:-30, sp:{
  "officinalis":{n:"Common lungwort"}
}},
"Punica":{n:"Pomegranate", f:"Lythraceae", min:-12, sp:{
  "granatum":{n:"Pomegranate"}
}},
"Puya":{min:-8, t:{w:1,d:1}},
"Pyracantha":{n:"Firethorn", f:"Rosaceae", min:-20, sp:{
  "coccinea":{n:"Scarlet firethorn"}
}},
"Pyrus":{n:"Pear", f:"Rosaceae", min:-30, sp:{
  "communis":{n:"Pear"},
  "calleryana":{n:"Callery pear", min:-25}
}},
"Quercus":{n:"Oak", f:"Fagaceae", min:-30, sp:{
  "robur":{n:"English oak"},
  "ilex":{n:"Holm oak", min:-15},
  "suber":{n:"Cork oak", min:-10},
  "rubra":{n:"Red oak", min:-35}
}},
"Ranunculus":{n:"Buttercup", f:"Ranunculaceae", min:-25, sp:{
  "asiaticus":{n:"Persian buttercup", min:-5, pat:"m"}
}},
"Ravenala":{min:10, pat:"i"},
"Rhaphidophora":{min:13, pat:"i"},
"Rhapidophyllum":{min:-18},
"Rhapis":{n:"Lady palm", f:"Arecaceae", min:-4, pat:"m", sp:{
  "excelsa":{n:"Lady palm"}
}},
"Rheum":{n:"Rhubarb", f:"Polygonaceae", min:-30, sp:{
  "rhabarbarum":{n:"Rhubarb"},
  "palmatum":{n:"Ornamental rhubarb", min:-25}
}},
"Rhipsalis":{min:7, pat:"i"},
"Rhododendron":{n:"Rhododendron", f:"Ericaceae", min:-20, sp:{
  "ponticum":{n:"Common rhododendron"},
  "simsii":{n:"Indoor azalea", min:0, pat:"m"},
  "yakushimanum":{n:"Yakushima rhododendron", min:-25},
  "luteum":{n:"Yellow azalea", min:-25}
}},
"Rhus":{n:"Sumac", f:"Anacardiaceae", min:-30, sp:{
  "typhina":{n:"Stag's horn sumac"}
}},
"Ribes":{n:"Currant", f:"Grossulariaceae", min:-30, sp:{
  "rubrum":{n:"Redcurrant"},
  "nigrum":{n:"Blackcurrant"},
  "uva-crispa":{n:"Gooseberry"},
  "sanguineum":{n:"Flowering currant", min:-20}
}},
"Ricinus":{n:"Castor oil plant", f:"Euphorbiaceae", min:2, t:{b:1}, sp:{
  "communis":{n:"Castor oil plant"}
}},
"Rodgersia":{min:-25, t:{d:3}},
"Rosa":{n:"Rose", f:"Rosaceae", min:-20, sp:{
  "banksiae":{n:"Banksian rose", min:-10},
  "canina":{n:"Dog rose"},
  "rugosa":{n:"Japanese rose", min:-35},
  "gallica":{n:"French rose"}
}},
"Rosmarinus":{n:"Rosemary", f:"Lamiaceae", min:-10, t:{d:1}, sp:{
  "officinalis":{n:"Rosemary"}
}},
"Rubus":{n:"Bramble", f:"Rosaceae", min:-25, sp:{
  "idaeus":{n:"Raspberry"},
  "fruticosus":{n:"Blackberry"}
}},
"Rudbeckia":{n:"Coneflower", f:"Asteraceae", min:-30, sp:{
  "fulgida":{n:"Black-eyed Susan"},
  "hirta":{n:"Black-eyed Susan", min:-20}
}},
"Ruscus":{n:"Butcher's broom", f:"Asparagaceae", min:-15, sp:{
  "aculeatus":{n:"Butcher's broom"}
}},
"Sabal":{n:"Palmetto", f:"Arecaceae", min:-12, t:{c:1}, sp:{
  "minor":{n:"Dwarf palmetto", min:-15},
  "palmetto":{n:"Cabbage palmetto", min:-10}
}},
"Sagittaria":{min:-20, t:{d:3}},
"Saintpaulia":{n:"African violet", f:"Gesneriaceae", min:15, pat:"i", sp:{
  "ionantha":{n:"African violet"}
}},
"Salix":{n:"Willow", f:"Salicaceae", min:-30, sp:{
  "babylonica":{n:"Weeping willow", min:-25},
  "alba":{n:"White willow"}
}},
"Salvia":{n:"Sage", f:"Lamiaceae", min:-5, sp:{
  "officinalis":{n:"Common sage", min:-15},
  "nemorosa":{n:"Balkan clary", min:-30},
  "rosmarinus":{n:"Rosemary", min:-10, t:{d:1}},
  "elegans":{n:"Pineapple sage", min:-3, pat:"m"},
  "microphylla":{n:"Baby sage", min:-10},
  "guaranitica":{n:"Anise-scented sage", min:-8},
  "involucrata":{n:"Roseleaf sage"}
}},
"Sambucus":{n:"Elder", f:"Adoxaceae", min:-30, sp:{
  "nigra":{n:"Elder"}
}},
"Sansevieria":{n:"Snake plant", f:"Asparagaceae", min:10, pat:"i", t:{d:1}, sp:{
  "trifasciata":{n:"Snake plant"},
  "cylindrica":{n:"Cylindrical snake plant"}
}},
"Santolina":{n:"Cotton lavender", f:"Asteraceae", min:-15, sp:{
  "chamaecyparissus":{n:"Cotton lavender"}
}},
"Sarcococca":{n:"Sweet box", f:"Buxaceae", min:-20, sp:{
  "confusa":{n:"Sweet box"},
  "hookeriana":{n:"Himalayan sweet box"}
}},
"Sasa":{min:-25},
"Saxifraga":{n:"Saxifrage", f:"Saxifragaceae", min:-20, sp:{
  "x urbium":{n:"London pride"},
  "stolonifera":{n:"Strawberry begonia", min:-10}
}},
"Schefflera":{n:"Umbrella tree", f:"Araliaceae", min:5, pat:"i", sp:{
  "arboricola":{n:"Dwarf umbrella tree"},
  "actinophylla":{n:"Umbrella tree", min:10, pat:"i"},
  "taiwaniana":{n:"Taiwan schefflera", min:-10},
  "delavayi":{n:"Delavay's schefflera", min:-10},
  "rhododendrifolia":{n:"Himalayan schefflera", min:-12}
}},
"Schlumbergera":{n:"Christmas cactus", f:"Cactaceae", min:5, pat:"i", sp:{
  "x buckleyi":{n:"Christmas cactus"},
  "truncata":{n:"Thanksgiving cactus"}
}},
"Scilla":{n:"Squill", f:"Asparagaceae", min:-30, sp:{
  "siberica":{n:"Siberian squill"}
}},
"Scindapsus":{min:13, pat:"i"},
"Sedum":{n:"Stonecrop", f:"Crassulaceae", min:-25, t:{d:1}, sp:{
  "spectabile":{n:"Ice plant", min:-30},
  "morganianum":{n:"Burro's tail", min:5, pat:"i"},
  "acre":{n:"Biting stonecrop", min:-30},
  "rubrotinctum":{n:"Jelly bean plant", min:0, pat:"m"}
}},
"Sempervivum":{n:"Houseleek", f:"Crassulaceae", min:-30, t:{d:1}, sp:{
  "tectorum":{n:"Common houseleek"},
  "arachnoideum":{n:"Cobweb houseleek"}
}},
"Senecio":{n:"Senecio", f:"Asteraceae", min:0, pat:"m", sp:{
  "rowleyanus":{n:"String of pearls", min:5, pat:"i", t:{d:1}},
  "cineraria":{n:"Silver ragwort", min:-5},
  "mandraliscae":{n:"Blue chalksticks"}
}},
"Skimmia":{n:"Skimmia", f:"Rutaceae", min:-20, sp:{
  "japonica":{n:"Japanese skimmia"}
}},
"Solanum":{n:"Nightshade", f:"Solanaceae", min:2, pat:"m", sp:{
  "lycopersicum":{n:"Tomato", min:5},
  "melongena":{n:"Aubergine", min:8},
  "tuberosum":{n:"Potato", min:0},
  "laxum":{n:"Potato vine", min:-8},
  "crispum":{n:"Chilean potato tree", min:-10},
  "rantonnetii":{n:"Blue potato bush", min:0, pat:"m"}
}},
"Soleirolia":{min:-10},
"Solenostemon":{n:"Coleus", f:"Lamiaceae", min:8, pat:"m", sp:{
  "scutellarioides":{n:"Coleus"}
}},
"Sorbus":{n:"Rowan", f:"Rosaceae", min:-35, sp:{
  "aucuparia":{n:"Rowan"}
}},
"Spathiphyllum":{n:"Peace lily", f:"Araceae", min:12, pat:"i", t:{d:3}, sp:{
  "wallisii":{n:"Peace lily"}
}},
"Spinacia":{n:"Spinach", f:"Amaranthaceae", min:-10, sp:{
  "oleracea":{n:"Spinach"}
}},
"Spiraea":{n:"Spiraea", f:"Rosaceae", min:-30, sp:{
  "japonica":{n:"Japanese spiraea"},
  "x vanhouttei":{n:"Bridal wreath"}
}},
"Stachys":{n:"Lamb's ears", f:"Lamiaceae", min:-30, sp:{
  "byzantina":{n:"Lamb's ears"}
}},
"Stevia":{min:0, pat:"m"},
"Stipa":{n:"Feather grass", f:"Poaceae", min:-20, sp:{
  "gigantea":{n:"Giant feather grass"},
  "tenuissima":{n:"Mexican feather grass", min:-15}
}},
"Strelitzia":{n:"Bird of paradise", f:"Strelitziaceae", min:3, pat:"m", ws:7, ww:21, sp:{
  "reginae":{n:"Bird of paradise", min:3, pat:"m", ws:7, ww:21, list:1},
  "nicolai":{n:"Giant white bird of paradise", min:2, pat:"m", t:{b:1}}
}},
"Streptocarpus":{n:"Cape primrose", f:"Gesneriaceae", min:10, pat:"i", sp:{
  "saxorum":{n:"False African violet"}
}},
"Stromanthe":{min:13, pat:"i"},
"Syngonium":{n:"Arrowhead vine", f:"Araceae", min:13, pat:"i", sp:{
  "podophyllum":{n:"Arrowhead plant"}
}},
"Syringa":{n:"Lilac", f:"Oleaceae", min:-30, sp:{
  "vulgaris":{n:"Common lilac"},
  "meyeri":{n:"Korean lilac"}
}},
"Tagetes":{n:"Marigold", f:"Asteraceae", min:2, sp:{
  "erecta":{n:"African marigold"},
  "patula":{n:"French marigold"}
}},
"Taxus":{n:"Yew", f:"Taxaceae", min:-25, sp:{
  "baccata":{n:"English yew"}
}},
"Tetrapanax":{n:"Rice paper plant", f:"Araliaceae", min:-8, pat:"o", ws:5, ww:21, t:{r:-15,b:1}, note:"Top can die back in hard frost and regrows from the roots. Mulch the base.", sp:{
  "papyrifer":{n:"Rice paper plant", min:-8, pat:"o", ws:5, ww:21, note:"Top can die back in hard frost and regrows from the roots. Mulch the base.", list:1}
}},
"Thalia":{min:-10, t:{d:3}},
"Thuja":{n:"Arborvitae", f:"Cupressaceae", min:-35, sp:{
  "occidentalis":{n:"White cedar"},
  "plicata":{n:"Western red cedar"}
}},
"Thymus":{n:"Thyme", f:"Lamiaceae", min:-20, sp:{
  "vulgaris":{n:"Common thyme"},
  "serpyllum":{n:"Wild thyme"},
  "citriodorus":{n:"Lemon thyme", min:-15}
}},
"Tillandsia":{n:"Air plant", f:"Bromeliaceae", min:8, pat:"i", sp:{
  "usneoides":{n:"Spanish moss", min:0, pat:"m"},
  "ionantha":{n:"Sky plant"},
  "cyanea":{n:"Pink quill"}
}},
"Trachelospermum":{n:"Star jasmine", f:"Apocynaceae", min:-10, sp:{
  "jasminoides":{n:"Star jasmine"},
  "asiaticum":{n:"Asiatic jasmine", min:-12}
}},
"Trachycarpus":{n:"Windmill palm", f:"Arecaceae", min:-15, pat:"o", ws:10, ww:30, t:{c:1,w:1}, note:"Very hardy palm. Keep water out of the crown in wet winters.", sp:{
  "fortunei":{n:"Chusan palm", min:-15, pat:"o", ws:10, ww:30, note:"Very hardy palm. Keep water out of the crown in wet winters.", list:1},
  "wagnerianus":{n:"Miniature Chusan palm"},
  "takil":{n:"Kumaon palm"},
  "princeps":{n:"Stone gate palm", min:-12}
}},
"Tradescantia":{n:"Spiderwort", f:"Commelinaceae", min:3, pat:"i", sp:{
  "zebrina":{n:"Inch plant", min:5, pat:"i"},
  "pallida":{n:"Purple heart", min:-3, pat:"m"},
  "fluminensis":{n:"Wandering Jew", min:0, pat:"m"},
  "spathacea":{n:"Moses-in-the-cradle", min:10, pat:"i"}
}},
"Trochodendron":{min:-15},
"Tropaeolum":{n:"Nasturtium", f:"Tropaeolaceae", min:0, sp:{
  "majus":{n:"Nasturtium"}
}},
"Tulipa":{n:"Tulip", f:"Liliaceae", min:-30, sp:{
  "gesneriana":{n:"Garden tulip"}
}},
"Typha":{min:-30, t:{d:3}},
"Vaccinium":{min:-25},
"Verbena":{n:"Verbena", f:"Verbenaceae", min:-10, sp:{
  "bonariensis":{n:"Purpletop vervain"},
  "officinalis":{n:"Vervain", min:-20}
}},
"Veronica":{n:"Speedwell", f:"Plantaginaceae", min:-30, sp:{
  "spicata":{n:"Spiked speedwell"}
}},
"Viburnum":{n:"Viburnum", f:"Adoxaceae", min:-20, sp:{
  "tinus":{n:"Laurustinus", min:-12},
  "opulus":{n:"Guelder rose", min:-35},
  "plicatum":{n:"Japanese snowball", min:-25},
  "x bodnantense":{n:"Bodnant viburnum", min:-25},
  "davidii":{n:"David viburnum", min:-15}
}},
"Vinca":{n:"Periwinkle", f:"Apocynaceae", min:-20, sp:{
  "minor":{n:"Lesser periwinkle"},
  "major":{n:"Greater periwinkle", min:-15}
}},
"Viola":{n:"Violet", f:"Violaceae", min:-20, sp:{
  "odorata":{n:"Sweet violet"},
  "x wittrockiana":{n:"Pansy", min:-15},
  "cornuta":{n:"Horned violet"}
}},
"Vitis":{n:"Grape vine", f:"Vitaceae", min:-20, t:{s:-1}, sp:{
  "vinifera":{n:"Grape vine"},
  "coignetiae":{n:"Crimson glory vine"}
}},
"Washingtonia":{n:"Fan palm", f:"Arecaceae", min:-5, t:{c:1}, sp:{
  "filifera":{n:"California fan palm", min:-8},
  "robusta":{n:"Mexican fan palm", min:-5}
}},
"Weigela":{n:"Weigela", f:"Caprifoliaceae", min:-30, sp:{
  "florida":{n:"Old-fashioned weigela"}
}},
"Wisteria":{n:"Wisteria", f:"Fabaceae", min:-25, sp:{
  "sinensis":{n:"Chinese wisteria"},
  "floribunda":{n:"Japanese wisteria"}
}},
"Woodwardia":{min:-8, sp:{
  "unigemmata":{min:-10}
}},
"Xanthosoma":{min:10, pat:"m"},
"Yucca":{n:"Yucca", f:"Asparagaceae", min:-10, t:{w:1,d:1}, sp:{
  "elephantipes":{n:"Spineless yucca", min:2, pat:"m"},
  "gloriosa":{n:"Spanish dagger", min:-15},
  "filamentosa":{n:"Adam's needle", min:-25},
  "rostrata":{n:"Beaked yucca", min:-18},
  "aloifolia":{n:"Spanish bayonet", min:-8}
}},
"Zamioculcas":{n:"ZZ plant", f:"Araceae", min:12, pat:"i", t:{d:1}, sp:{
  "zamiifolia":{n:"ZZ plant"}
}},
"Zantedeschia":{n:"Calla lily", f:"Araceae", min:-10, t:{d:3}, sp:{
  "aethiopica":{n:"Arum lily"}
}},
"Zea":{min:2},
"Zingiber":{n:"Ginger", f:"Zingiberaceae", min:5, pat:"m", sp:{
  "officinale":{n:"Ginger"},
  "mioga":{n:"Japanese ginger", min:-15}
}},
"Zinnia":{n:"Zinnia", f:"Asteraceae", min:2, sp:{
  "elegans":{n:"Common zinnia"}
}}
};

/* Watering for a new plant with no interval of its own, by water need (summer, winter). */
const NEED = {1:{ws:14, ww:30}, 2:{ws:7, ww:14}, 3:{ws:3, ww:10}};
const PAT = {o:"outdoor", m:"mover", g:"greenhouse", i:"indoor"};
const patFor = min => min <= -5 ? "outdoor" : min >= 10 ? "indoor" : "mover";
const SPREAD = 4;   // a genus whose species differ by more than this (°C) gets a "rough guess"

/* Index: "musa" → genus entry, "musa basjoo" → species entry, with their names as written here. */
const IDX = {};
for(const [g, G] of Object.entries(DATA)){
  const mins = [G.min, ...Object.values(G.sp || {}).map(s => s.min)].filter(v => v != null);
  G.lo = mins.length ? Math.min(...mins) : null; G.hi = mins.length ? Math.max(...mins) : null;
  IDX[g.toLowerCase()] = {name:g, genus:g, e:G, G};
  for(const [ep, S] of Object.entries(G.sp || {})) IDX[`${g} ${ep}`.toLowerCase()] = {name:`${g} ${ep}`, genus:g, e:S, G};
}

/* "Musa basjoo 'Sakhalin'" → "musa basjoo"; "Abelia × grandiflora" → "abelia x grandiflora"; "Citrus (lemon)" → "citrus" */
function speciesKey(s){
  const w = String(s || "").toLowerCase().replace(/×/g, "x").replace(/['"‘’“”(].*$/, "").trim().split(/\s+/).filter(Boolean);
  return (w[1] === "x" ? w.slice(0, 3) : w.slice(0, 2)).join(" ");
}
const genusKey = (species, genus) => (String(genus || "").trim().toLowerCase().split(/\s+/)[0]) || speciesKey(species).split(" ")[0];

function traits(species, genus){
  const sp = speciesKey(species), G = IDX[genusKey(species, genus)], S = sp.includes(" ") ? IDX[sp] : null;
  return {...((G && G.e.t) || {}), ...((S && S.e.t) || {})};
}
function intervals(species, genus){
  const t = traits(species, genus);
  return t.d ? {...NEED[t.d], need:t.d} : null;
}

/* Everything Alvor knows for what someone typed: the species if it's here, else its genus. null if neither.
   {s, how, min, pat, note, ws?, ww?, src:{min, water}, sure (2 fairly sure, 1 rough guess), range?, n, family, traits, need} */
function find(species, genus){
  const sp = speciesKey(species), gk = genusKey(species, genus);
  if(!sp && !gk) return null;
  const G = IDX[gk] && IDX[gk].e === IDX[gk].G ? IDX[gk] : null;
  const S = sp.includes(" ") && IDX[sp] && IDX[sp].e.min != null ? IDX[sp] : null;
  const at = S || (G && G.e.min != null ? G : null);
  if(!at) return null;
  const e = at.e, GE = at.G, t = traits(species, genus);
  const how = S ? "species" : sp.includes(" ") ? "related" : "genus";
  const r = {s:at.name, how, min:e.min, pat:PAT[e.pat] || patFor(e.min), note:e.note || "",
    n:e.n || "", family:GE.f || "", traits:t, need:t.d || 2, src:{min:S ? (e.list ? "list" : "species") : how, water:null}, sure:2};
  if(!S){
    if(GE.hi - GE.lo > SPREAD) r.sure = 1;
    if(GE.hi !== GE.lo) r.range = [GE.lo, GE.hi];
  }
  /* Watering: the species', else the genus', else from how much water the plant needs. */
  const w = S && e.ws != null ? e : GE.ws != null ? GE : null, nd = intervals(species, genus);
  if(w){ r.ws = w.ws; r.ww = w.ww; r.src.water = w === e && S ? (e.list ? "list" : "species") : "genus"; }
  else if(nd){ r.ws = nd.ws; r.ww = nd.ww; r.src.water = "need"; }
  return r;
}

/* ---------- Your plant and Alvor's knowledge ---------- */
/* A plant keeps a value of its own only where it differs from Alvor's: p.own = {min, water}, true where the value is
   yours. Everything else follows this file, so a better value here reaches the plant (and the server, which uses
   apply() too, agrees with the app even before the phone has saved it). Plants from before (no p.own) stay as saved
   until the app works out p.own for them. */
const DEFAULT_WATER = {ws:7, ww:14};
const num = v => v === null || v === undefined || v === "" || !isFinite(+v) ? null : +v;
function ownOf(p, r){
  if(r === undefined) r = find(p.species, p.genus);
  const min = num(p.minTemp), w = r && r.ws != null ? r : DEFAULT_WATER;
  return {min:r && r.min != null ? min !== r.min : min !== null, water:num(p.ws) !== w.ws || num(p.ww) !== w.ww};
}
/* The plant with Alvor's values where it follows them: the same object when nothing differs. */
function apply(p){
  if(!p || !p.own) return p;
  const r = find(p.species, p.genus); if(!r) return p;
  const o = {};
  if(!p.own.min && r.min != null && num(p.minTemp) !== r.min) o.minTemp = r.min;
  if(!p.own.water && r.ws != null && (num(p.ws) !== r.ws || num(p.ww) !== r.ww)){ o.ws = r.ws; o.ww = r.ww; }
  return Object.keys(o).length ? {...p, ...o} : p;
}

/* For the species search: every named genus and species, in order. */
function names(){
  const out = [];
  for(const [g, G] of Object.entries(DATA)){
    if(!G.n) continue;
    out.push({kind:"genus", name:g, genus:g, family:G.f || "", common:G.n});
    for(const [ep, S] of Object.entries(G.sp || {})) if(S.n) out.push({kind:"species", name:`${g} ${ep}`, genus:g, family:G.f || "", common:S.n});
  }
  return out;
}
/* The plants Alvor started with (offered first in the edit screen's species field). */
const starting = () => Object.values(IDX).filter(x => x.e.list).map(x => x.name);
/* Every care note, for the language tests. */
const notes = () => Object.values(IDX).map(x => x.e.note).filter(Boolean);

return {VERSION, DATA, NEED, DEFAULT_WATER, speciesKey, traits, intervals, find, ownOf, apply, names, starting, notes};
});
