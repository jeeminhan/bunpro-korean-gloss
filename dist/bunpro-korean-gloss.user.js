// ==UserScript==
// @name         Bunpro Korean Gloss
// @namespace    jeeminhan.bunpro.korean
// @version      0.1.0
// @description  Show a concise Korean equivalent for the grammar point + an inline Korean translation of the whole sentence on Bunpro review/study cards.
// @author       Jeemin Han
// @match        https://bunpro.jp/*
// @exclude      https://community.bunpro.jp/*
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @connect      api.mymemory.translated.net
// @run-at       document-idle
// ==/UserScript==

/* eslint-disable */
(function () {
  'use strict';

  // ----------------------------------------------------------------------------
  // Config
  // ----------------------------------------------------------------------------
  // Flip to true and reload Bunpro to print what the script detects to the
  // browser console (grammar id / title / sentence / chosen selectors). Paste
  // that output back to finalize selectors if a gloss ever fails to appear.
  const DEBUG = false;

  // Set false to hide the full-sentence Korean translation (keep only the
  // grammar-point gloss).
  const SHOW_SENTENCE_TRANSLATION = true;

  const STYLE_ID = 'bkg-style';
  const BOX_CLASS = 'bkg-box';
  const LS_CACHE = 'bkg.translateCache.v1';
  const LS_UNKNOWN = 'bkg.unknownPoints.v1';

  // Injected dictionary. Built from src/glosses.json by scripts/build.mjs.
  // Shape: [{ id?: number, title: string, level: string, ko: string }]
  const GLOSSES = [{"title":"〜ようではないか","level":"N2","ko":"~하지 않겠는가"},{"title":"〜得ない","level":"N2","ko":"~할 수 없다"},{"title":"あげく","level":"N2","ko":"~한 끝에"},{"title":"いきなり","level":"N2","ko":"갑자기"},{"title":"いつの間にか","level":"N2","ko":"어느새"},{"title":"いよいよ","level":"N2","ko":"드디어"},{"title":"いわゆる","level":"N2","ko":"이른바"},{"title":"おおよそ","level":"N2","ko":"대략"},{"title":"おそらく","level":"N2","ko":"아마"},{"title":"おまけに","level":"N2","ko":"게다가"},{"title":"および","level":"N2","ko":"및"},{"title":"お～願う","level":"N2","ko":"~해 주시기 바랍니다"},{"title":"か〜ないかのうちに","level":"N2","ko":"~하자마자"},{"title":"かと思ったら","level":"N2","ko":"~인가 했더니"},{"title":"かねない","level":"N2","ko":"~할지도 모른다"},{"title":"かねる","level":"N2","ko":"~하기 어렵다"},{"title":"かのようだ","level":"N2","ko":"~인 것처럼"},{"title":"からして","level":"N2","ko":"~부터가"},{"title":"からすると","level":"N2","ko":"~로 보면"},{"title":"からといって","level":"N2","ko":"~라고 해서"},{"title":"からには","level":"N2","ko":"~한 이상"},{"title":"から見ると","level":"N2","ko":"~로 보면"},{"title":"か何か","level":"N2","ko":"~인가 뭔가"},{"title":"がけに","level":"N2","ko":"~하는 길에"},{"title":"が気になる","level":"N2","ko":"~이 신경 쓰인다"},{"title":"きっかけ","level":"N2","ko":"계기"},{"title":"げ","level":"N2","ko":"~한 듯한"},{"title":"ことだから","level":"N2","ko":"~이니까 (성격상)"},{"title":"ことなく","level":"N2","ko":"~하는 일 없이"},{"title":"ことになっている","level":"N2","ko":"~하기로 되어 있다"},{"title":"ことにはならない","level":"N2","ko":"~한 것이 되지는 않는다"},{"title":"ことは〜が","level":"N2","ko":"~하기는 하지만"},{"title":"さすが","level":"N2","ko":"역시"},{"title":"ざるを得ない","level":"N2","ko":"~하지 않을 수 없다"},{"title":"しかしながら","level":"N2","ko":"그러나"},{"title":"しかも","level":"N2","ko":"게다가"},{"title":"したがって","level":"N2","ko":"따라서"},{"title":"ずに済む","level":"N2","ko":"~하지 않고 끝나다"},{"title":"せめて","level":"N2","ko":"적어도"},{"title":"そういえば","level":"N2","ko":"그러고 보니"},{"title":"そうにない","level":"N2","ko":"~할 것 같지 않다"},{"title":"その上","level":"N2","ko":"게다가"},{"title":"それとも","level":"N2","ko":"아니면"},{"title":"それなのに","level":"N2","ko":"그런데도"},{"title":"それなら","level":"N2","ko":"그렇다면"},{"title":"それにしても","level":"N2","ko":"그렇다 해도"},{"title":"たちまち","level":"N2","ko":"순식간에"},{"title":"たった(の)","level":"N2","ko":"단지 / 겨우"},{"title":"たって","level":"N2","ko":"~해도 / ~라고 해도"},{"title":"たまえ","level":"N2","ko":"~하게 (명령)"},{"title":"た末","level":"N2","ko":"~한 끝에"},{"title":"だけあって","level":"N2","ko":"~인 만큼 (역시)"},{"title":"だけに","level":"N2","ko":"~인 만큼"},{"title":"だけのことはある","level":"N2","ko":"~할 만하다"},{"title":"だけは","level":"N2","ko":"~만은 (다 하다)"},{"title":"だけましだ","level":"N2","ko":"~만으로도 다행이다"},{"title":"っこない","level":"N2","ko":"~할 리 없다"},{"title":"つつ","level":"N2","ko":"~하면서"},{"title":"つつ(も)","level":"N2","ko":"~하면서도"},{"title":"つつある","level":"N2","ko":"~하고 있는 중이다"},{"title":"つもりで","level":"N2","ko":"~할 셈으로"},{"title":"ていては","level":"N2","ko":"~하고 있어서는"},{"title":"てからでないと","level":"N2","ko":"~하고 나서가 아니면"},{"title":"てしょうがない","level":"N2","ko":"너무 ~하다 (못 견디게)"},{"title":"てたまらない","level":"N2","ko":"너무 ~해서 견딜 수 없다"},{"title":"てでも","level":"N2","ko":"~해서라도"},{"title":"てならない","level":"N2","ko":"~해서 견딜 수 없다"},{"title":"ては","level":"N2","ko":"~해서는"},{"title":"ては〜ては","level":"N2","ko":"~하고는 ~하고"},{"title":"てはいられない","level":"N2","ko":"~하고 있을 수는 없다"},{"title":"てはならない","level":"N2","ko":"~해서는 안 된다"},{"title":"て当然だ","level":"N2","ko":"~하는 것이 당연하다"},{"title":"でしかない","level":"N2","ko":"~에 지나지 않다"},{"title":"ということは","level":"N2","ko":"~라는 것은"},{"title":"というものだ","level":"N2","ko":"~라는 것이다"},{"title":"というものでもない","level":"N2","ko":"~라는 것도 아니다"},{"title":"というわけではない","level":"N2","ko":"~라는 것은 아니다"},{"title":"という点から考えると","level":"N2","ko":"~라는 점에서 생각하면"},{"title":"という風に","level":"N2","ko":"~라는 식으로"},{"title":"といった","level":"N2","ko":"~와 같은"},{"title":"とか","level":"N2","ko":"~라든가"},{"title":"ところだった ②","level":"N2","ko":"~할 뻔했다"},{"title":"ところを見ると","level":"N2","ko":"~하는 것을 보니"},{"title":"としては","level":"N2","ko":"~로서는"},{"title":"としても","level":"N2","ko":"~라고 해도"},{"title":"とっくに","level":"N2","ko":"진작에 / 벌써"},{"title":"とも","level":"N2","ko":"~하더라도 / ~든"},{"title":"と考えられる","level":"N2","ko":"~라고 생각된다"},{"title":"どうせ","level":"N2","ko":"어차피"},{"title":"どうやら","level":"N2","ko":"아무래도"},{"title":"どころではない","level":"N2","ko":"~할 상황이 아니다"},{"title":"ないことには～ない","level":"N2","ko":"~하지 않고서는 ~않다"},{"title":"ないではいられない","level":"N2","ko":"~하지 않을 수 없다"},{"title":"ないわけにはいかない","level":"N2","ko":"~하지 않을 수 없다"},{"title":"なお①","level":"N2","ko":"더욱 / 한층"},{"title":"なお②","level":"N2","ko":"또한 / 덧붙여"},{"title":"なくはない","level":"N2","ko":"~하지 않는 것은 아니다"},{"title":"なにやら","level":"N2","ko":"무언가 / 어쩐지"},{"title":"ならともかく","level":"N2","ko":"~라면 몰라도"},{"title":"にあたり","level":"N2","ko":"~에 즈음하여"},{"title":"にかかわらず","level":"N2","ko":"~에 관계없이"},{"title":"にかかわる","level":"N2","ko":"~에 관계되는 / ~이 걸린"},{"title":"にかけては","level":"N2","ko":"~에 관해서는"},{"title":"にしたがって","level":"N2","ko":"~함에 따라"},{"title":"にしたら","level":"N2","ko":"~의 입장에서는"},{"title":"にしても～にしても","level":"N2","ko":"~든 ~든"},{"title":"にしろ～にしろ","level":"N2","ko":"~든 ~든"},{"title":"にすぎない","level":"N2","ko":"~에 지나지 않다"},{"title":"にせよ","level":"N2","ko":"~라 하더라도"},{"title":"につき","level":"N2","ko":"~당 / ~에 대해"},{"title":"につけ","level":"N2","ko":"~할 때마다"},{"title":"にて","level":"N2","ko":"~에서 / ~로 (문어)"},{"title":"には","level":"N2","ko":"~하기에는"},{"title":"にほかならない","level":"N2","ko":"바로 ~이다"},{"title":"にもかかわらず","level":"N2","ko":"~에도 불구하고"},{"title":"にわたって","level":"N2","ko":"~에 걸쳐"},{"title":"に伴って","level":"N2","ko":"~에 따라"},{"title":"に先立ち","level":"N2","ko":"~에 앞서"},{"title":"に加えて","level":"N2","ko":"~에 더하여"},{"title":"に反して","level":"N2","ko":"~에 반하여"},{"title":"に向かって","level":"N2","ko":"~을 향해"},{"title":"に応えて","level":"N2","ko":"~에 부응하여"},{"title":"に応じて","level":"N2","ko":"~에 따라 / ~에 맞추어"},{"title":"に気をつける","level":"N2","ko":"~에 조심하다 / ~에 주의하다"},{"title":"に決まっている","level":"N2","ko":"~임에 틀림없다"},{"title":"に沿って","level":"N2","ko":"~을 따라"},{"title":"に相違ない","level":"N2","ko":"~임에 틀림없다"},{"title":"に越したことはない","level":"N2","ko":"~하는 것이 최고다"},{"title":"に限って","level":"N2","ko":"~에 한해서 / 하필 ~이"},{"title":"に限らず","level":"N2","ko":"~뿐만 아니라"},{"title":"に際して","level":"N2","ko":"~에 즈음하여"},{"title":"ぬ","level":"N2","ko":"~하지 않다 (문어)"},{"title":"ねばならない","level":"N2","ko":"~해야 한다"},{"title":"のではないだろうか","level":"N2","ko":"~인 것은 아닐까"},{"title":"のみならず","level":"N2","ko":"~뿐만 아니라"},{"title":"のももっともだ","level":"N2","ko":"~하는 것도 당연하다"},{"title":"のも当然だ","level":"N2","ko":"~하는 것도 당연하다"},{"title":"の下で","level":"N2","ko":"~아래에서"},{"title":"はたして","level":"N2","ko":"과연"},{"title":"はともかく","level":"N2","ko":"~은 차치하고"},{"title":"はもとより","level":"N2","ko":"~은 물론"},{"title":"は別として","level":"N2","ko":"~은 별도로 하고"},{"title":"ふうに","level":"N2","ko":"~식으로"},{"title":"ぶりに","level":"N2","ko":"~만에"},{"title":"まい","level":"N2","ko":"~하지 않겠다 / ~하지 않을 것이다"},{"title":"ものか","level":"N2","ko":"~할까 보냐"},{"title":"ものがある","level":"N2","ko":"~한 데가 있다"},{"title":"ものだから","level":"N2","ko":"~이기 때문에"},{"title":"ものですから","level":"N2","ko":"~이기 때문에"},{"title":"ものなら①","level":"N2","ko":"~할 수 있다면"},{"title":"ものの","level":"N2","ko":"~이지만"},{"title":"も又","level":"N2","ko":"~도 또한"},{"title":"も構わず","level":"N2","ko":"~도 아랑곳없이"},{"title":"も～ば～も","level":"N2","ko":"~도 ~하고 ~도"},{"title":"やがて","level":"N2","ko":"머지않아 / 이윽고"},{"title":"やら～やら","level":"N2","ko":"~며 ~며"},{"title":"ようがない","level":"N2","ko":"~할 방법이 없다"},{"title":"ようでは","level":"N2","ko":"~해서는"},{"title":"よりしかたがない","level":"N2","ko":"~할 수밖에 없다"},{"title":"よりほかない","level":"N2","ko":"~할 수밖에 없다"},{"title":"をもとに","level":"N2","ko":"~을 바탕으로 / ~을 토대로"},{"title":"を中心に","level":"N2","ko":"~을 중심으로"},{"title":"を問わず","level":"N2","ko":"~을 불문하고"},{"title":"を契機に","level":"N2","ko":"~을 계기로"},{"title":"を巡って","level":"N2","ko":"~을 둘러싸고"},{"title":"を込めて","level":"N2","ko":"~을 담아"},{"title":"を通じて","level":"N2","ko":"~을 통해"},{"title":"を除いて","level":"N2","ko":"~을 제외하고"},{"title":"一応 ①","level":"N2","ko":"일단"},{"title":"一応 ②","level":"N2","ko":"대충 / 그런대로"},{"title":"一旦","level":"N2","ko":"일단"},{"title":"万が一","level":"N2","ko":"만일"},{"title":"上","level":"N2","ko":"~상 / ~인 이상"},{"title":"上に","level":"N2","ko":"~인 데다가"},{"title":"上は","level":"N2","ko":"~한 이상"},{"title":"中を","level":"N2","ko":"~을 무릅쓰고"},{"title":"以上 ②","level":"N2","ko":"~인 이상"},{"title":"以上に","level":"N2","ko":"~이상으로"},{"title":"以来","level":"N2","ko":"~이래"},{"title":"何から何まで","level":"N2","ko":"이것저것 모두"},{"title":"何しろ","level":"N2","ko":"어쨌든 / 워낙"},{"title":"何といっても","level":"N2","ko":"뭐니뭐니 해도"},{"title":"何より","level":"N2","ko":"무엇보다"},{"title":"傾向がある","level":"N2","ko":"~경향이 있다"},{"title":"僅かに","level":"N2","ko":"근소하게 / 겨우"},{"title":"反面","level":"N2","ko":"~인 반면"},{"title":"幸い","level":"N2","ko":"다행히"},{"title":"後(の) Noun","level":"N2","ko":"~한 후의 ~"},{"title":"得る","level":"N2","ko":"~할 수 있다"},{"title":"思うように","level":"N2","ko":"생각대로"},{"title":"恐れがある","level":"N2","ko":"~우려가 있다"},{"title":"手前","level":"N2","ko":"~인 체면상 / ~앞에서"},{"title":"抜きで","level":"N2","ko":"~없이 / ~빼고"},{"title":"抜く","level":"N2","ko":"끝까지 ~하다"},{"title":"更に","level":"N2","ko":"더욱 / 게다가"},{"title":"未だに","level":"N2","ko":"아직껏 / 여전히"},{"title":"次第だ","level":"N2","ko":"~에 달려 있다"},{"title":"次第に","level":"N2","ko":"점차"},{"title":"気","level":"N2","ko":"~한 기분 / ~할 마음"},{"title":"活かす","level":"N2","ko":"살리다 / 활용하다"},{"title":"甲斐がある","level":"N2","ko":"~한 보람이 있다"},{"title":"確かに","level":"N2","ko":"확실히"},{"title":"精々","level":"N2","ko":"기껏해야"},{"title":"結果","level":"N2","ko":"~한 결과"},{"title":"要するに","level":"N2","ko":"요컨대"},{"title":"逆に","level":"N2","ko":"반대로"},{"title":"途中に","level":"N2","ko":"~하는 도중에"},{"title":"限り","level":"N2","ko":"~하는 한"},{"title":"陸に～ない","level":"N2","ko":"제대로 ~않다"},{"title":"際に","level":"N2","ko":"~할 때"},{"title":"～ざる","level":"N2","ko":"~하지 않는 (문어)"},{"title":"～てこそ","level":"N2","ko":"~해야만 / ~하고서야"},{"title":"～て頂戴","level":"N2","ko":"~해 줘 / ~해 주세요"},{"title":"～ところに","level":"N2","ko":"~하는 참에"},{"title":"～に値する","level":"N2","ko":"~할 가치가 있다"},{"title":"～のうち(で)","level":"N2","ko":"~중에서"},{"title":"～を～に任せる","level":"N2","ko":"~을 ~에 맡기다"},{"title":"Noun＋型","level":"N3","ko":"~형 / ~타입","id":625},{"title":"Particle + の","level":"N3","ko":"조사 + の (~의 / ~에서의)","id":620},{"title":"Verb[volitio...","level":"N3","ko":"~하려고 하다"},{"title":"〜かは〜によって違う","level":"N3","ko":"~인지는 ~에 따라 다르다","id":619},{"title":"〜ようとしない","level":"N3","ko":"~하려고 하지 않다","id":279},{"title":"あまり","level":"N3","ko":"그다지 (~않다)","id":218},{"title":"あまりに","level":"N3","ko":"너무나","id":230},{"title":"あり","level":"N3","ko":"있음 / ~가능","id":1077},{"title":"あるいは","level":"N3","ko":"혹은","id":477},{"title":"いくら〜でも","level":"N3","ko":"아무리 ~라도","id":232},{"title":"うちに","level":"N3","ko":"~하는 사이에 / ~하는 동안에","id":211},{"title":"おかげで","level":"N3","ko":"~덕분에","id":238},{"title":"おきに","level":"N3","ko":"~간격으로 / ~마다","id":478},{"title":"かけ","level":"N3","ko":"~하다 만 / ~하던 중","id":307},{"title":"かなり","level":"N3","ko":"꽤","id":675},{"title":"からこそ","level":"N3","ko":"~기 때문에 (바로)","id":446},{"title":"から言うと","level":"N3","ko":"~로 말하자면","id":244},{"title":"がたい","level":"N3","ko":"~하기 어렵다","id":257},{"title":"がち","level":"N3","ko":"~하기 십상 / 자주 ~함","id":305},{"title":"きり","level":"N3","ko":"~한 채 / ~한 이후로","id":309},{"title":"ぎみ","level":"N3","ko":"~기색 / ~기운","id":306},{"title":"くせに","level":"N3","ko":"~인 주제에 / ~면서도","id":295},{"title":"くらい ②","level":"N3","ko":"~정도","id":234},{"title":"こそ","level":"N3","ko":"~야말로","id":258},{"title":"ことか","level":"N3","ko":"얼마나 ~한지","id":245},{"title":"ことから","level":"N3","ko":"~인 점에서 / ~때문에","id":259},{"title":"ことがある","level":"N3","ko":"~한 적이 있다","id":222},{"title":"ことだ","level":"N3","ko":"~해야 한다 (충고)","id":199},{"title":"ことなの","level":"N3","ko":"~라는 것이다","id":630},{"title":"ことに","level":"N3","ko":"~하게도","id":270},{"title":"ことにする","level":"N3","ko":"~하기로 하다","id":294},{"title":"ことになる","level":"N3","ko":"~하게 되다","id":283},{"title":"ことはない","level":"N3","ko":"~할 필요는 없다","id":233},{"title":"さ - Casual よ","level":"N3","ko":"~잖아 / ~야 (강조)","id":760},{"title":"さ - Filler","level":"N3","ko":"있잖아 / 그러니까 (군말)","id":665},{"title":"さ - Interjec...","level":"N3","ko":"자 / 그래 (감탄)"},{"title":"さえ","level":"N3","ko":"~조차 / ~마저","id":248},{"title":"さえ〜ば","level":"N3","ko":"~만 ~하면","id":264},{"title":"さて","level":"N3","ko":"자, 그런데","id":458},{"title":"しかない","level":"N3","ko":"~할 수밖에 없다","id":249},{"title":"すでに","level":"N3","ko":"이미","id":484},{"title":"すると","level":"N3","ko":"그러자","id":438},{"title":"ずっと ②","level":"N3","ko":"훨씬","id":759},{"title":"ずに","level":"N3","ko":"~하지 않고","id":303},{"title":"ずにはいられない","level":"N3","ko":"~하지 않을 수 없다","id":315},{"title":"せいで","level":"N3","ko":"~탓에","id":274},{"title":"そうすると","level":"N3","ko":"그렇게 하면","id":445},{"title":"そうだ","level":"N3","ko":"~라고 한다 (전문)","id":200},{"title":"そうもない","level":"N3","ko":"~할 것 같지도 않다","id":275},{"title":"そこで","level":"N3","ko":"그래서","id":454},{"title":"そのため(に)","level":"N3","ko":"그 때문에","id":447},{"title":"その結果","level":"N3","ko":"그 결과","id":288},{"title":"それぞれ","level":"N3","ko":"각각","id":449},{"title":"たて","level":"N3","ko":"갓 ~한","id":483},{"title":"たとえ〜ても","level":"N3","ko":"설령 ~해도","id":276},{"title":"たとたんに","level":"N3","ko":"~하자마자","id":313},{"title":"たびに","level":"N3","ko":"~할 때마다","id":301},{"title":"ため(に)","level":"N3","ko":"~때문에","id":205},{"title":"ために","level":"N3","ko":"~하기 위해","id":215},{"title":"たものだ","level":"N3","ko":"~하곤 했다","id":487},{"title":"たらいい","level":"N3","ko":"~하면 좋겠다"},{"title":"だけしか","level":"N3","ko":"~밖에","id":489},{"title":"だけでなく(て)～も","level":"N3","ko":"~뿐만 아니라 ~도","id":481},{"title":"だって","level":"N3","ko":"~래 / ~라도 / 왜냐면","id":452},{"title":"だらけ","level":"N3","ko":"~투성이","id":243},{"title":"ちゃんと","level":"N3","ko":"제대로"},{"title":"っけ","level":"N3","ko":"~던가? / ~였더라?","id":308},{"title":"って","level":"N3","ko":"~란 / ~라고 (= は・と)","id":435},{"title":"っぱなし","level":"N3","ko":"~한 채로 (방치)","id":299},{"title":"っぽい","level":"N3","ko":"~스럽다 / ~같다","id":312},{"title":"つい","level":"N3","ko":"그만 / 무심코","id":488},{"title":"ついでに","level":"N3","ko":"~하는 김에","id":290},{"title":"つまり","level":"N3","ko":"즉","id":252},{"title":"てごらん","level":"N3","ko":"~해 봐","id":314},{"title":"てもかまわない","level":"N3","ko":"~해도 상관없다","id":239},{"title":"て初めて","level":"N3","ko":"~하고 나서야 비로소","id":277},{"title":"である","level":"N3","ko":"~이다 (문어체)","id":436},{"title":"できれば","level":"N3","ko":"가능하면"},{"title":"では","level":"N3","ko":"그럼 / 그렇다면"},{"title":"ではなくて","level":"N3","ko":"~이 아니라"},{"title":"でもある","level":"N3","ko":"~이기도 하다","id":666},{"title":"でよければ","level":"N3","ko":"~라도 괜찮다면","id":476},{"title":"で言うと","level":"N3","ko":"~로 말하면","id":651},{"title":"という","level":"N3","ko":"~라는","id":202},{"title":"ということだ","level":"N3","ko":"~라고 한다","id":216},{"title":"というのは","level":"N3","ko":"~란","id":228},{"title":"というより","level":"N3","ko":"~라기보다","id":250},{"title":"という理由で","level":"N3","ko":"~라는 이유로","id":645},{"title":"といえば","level":"N3","ko":"~로 말하자면","id":240},{"title":"とおり","level":"N3","ko":"~대로","id":289},{"title":"ところが","level":"N3","ko":"그런데 / 그러나","id":206},{"title":"ところだった ①","level":"N3","ko":"~할 뻔했다","id":448},{"title":"ところで","level":"N3","ko":"그런데 / ~해 봤자","id":217},{"title":"としたら","level":"N3","ko":"~라고 한다면"},{"title":"として","level":"N3","ko":"~로서","id":265},{"title":"とても～ない","level":"N3","ko":"도저히 ~할 수 없다","id":460},{"title":"とは限らない","level":"N3","ko":"~라고는 할 수 없다","id":278},{"title":"と並んで","level":"N3","ko":"~와 나란히","id":658},{"title":"と共に","level":"N3","ko":"~와 함께","id":291},{"title":"と同じくらい","level":"N3","ko":"~와 같은 정도로","id":624},{"title":"と同じで","level":"N3","ko":"~와 마찬가지로"},{"title":"と同時に","level":"N3","ko":"~와 동시에","id":453},{"title":"と言える","level":"N3","ko":"~라고 할 수 있다","id":629},{"title":"どうしても","level":"N3","ko":"아무리 해도 / 꼭","id":491},{"title":"どころか","level":"N3","ko":"~은커녕","id":304},{"title":"どんなに〜ても","level":"N3","ko":"아무리 ~해도","id":220},{"title":"ないうちに","level":"N3","ko":"~하기 전에","id":451},{"title":"ないことはない","level":"N3","ko":"~하지 못할 것은 없다","id":310},{"title":"なかなか","level":"N3","ko":"좀처럼 / 꽤","id":437},{"title":"なかなか～ない","level":"N3","ko":"좀처럼 ~않다","id":444},{"title":"ながらも","level":"N3","ko":"~면서도","id":285},{"title":"なし","level":"N3","ko":"~없이 / ~없음","id":663},{"title":"なぜなら〜から","level":"N3","ko":"왜냐하면 ~때문이다","id":203},{"title":"なんか","level":"N3","ko":"~따위 / ~같은 거"},{"title":"において","level":"N3","ko":"~에 있어서 / ~에서"},{"title":"にかけて","level":"N3","ko":"~에 걸쳐","id":311},{"title":"にしては","level":"N3","ko":"~치고는","id":273},{"title":"にしても","level":"N3","ko":"~라 하더라도","id":262},{"title":"について","level":"N3","ko":"~에 대해","id":225},{"title":"につれて","level":"N3","ko":"~함에 따라","id":298},{"title":"にもとづいて","level":"N3","ko":"~에 근거하여","id":495},{"title":"によって","level":"N3","ko":"~에 의해 / ~에 따라"},{"title":"によると","level":"N3","ko":"~에 의하면"},{"title":"に代わって","level":"N3","ko":"~을 대신하여","id":297},{"title":"に取って","level":"N3","ko":"~에게 있어서","id":247},{"title":"に合わせて","level":"N3","ko":"~에 맞추어"},{"title":"に対して","level":"N3","ko":"~에 대해 / ~에 반해","id":237},{"title":"に当たる","level":"N3","ko":"~에 해당하다","id":640},{"title":"に比べて","level":"N3","ko":"~에 비해","id":224},{"title":"に違いない","level":"N3","ko":"~임에 틀림없다","id":286},{"title":"に関する","level":"N3","ko":"~에 관한"},{"title":"に限る","level":"N3","ko":"~이 최고다 / ~에 한하다","id":472},{"title":"のに","level":"N3","ko":"~인데도","id":440},{"title":"のはXの方だ","level":"N3","ko":"~인 것은 X 쪽이다","id":633},{"title":"の間に","level":"N3","ko":"~하는 동안에","id":210},{"title":"はもちろん","level":"N3","ko":"~은 물론","id":463},{"title":"は言うまでもない ①","level":"N3","ko":"~은 말할 것도 없다","id":647},{"title":"は～くらいです","level":"N3","ko":"~정도가 고작이다","id":469},{"title":"ば〜ほど","level":"N3","ko":"~하면 ~할수록","id":207},{"title":"ばいい","level":"N3","ko":"~하면 된다","id":195},{"title":"ばかり","level":"N3","ko":"~뿐 / 막 ~한 참","id":219},{"title":"ばかりだ","level":"N3","ko":"~하기만 한다","id":231},{"title":"ばかりでなく","level":"N3","ko":"~뿐만 아니라","id":255},{"title":"ばかりに","level":"N3","ko":"~한 탓에","id":242},{"title":"ふりをする","level":"N3","ko":"~하는 척하다","id":269},{"title":"べき","level":"N3","ko":"~해야 한다","id":196},{"title":"べきではない","level":"N3","ko":"~해서는 안 된다","id":209},{"title":"ほど","level":"N3","ko":"~정도 / ~만큼","id":201},{"title":"ほど～ない","level":"N3","ko":"~만큼 ~않다","id":221},{"title":"まさか","level":"N3","ko":"설마","id":467},{"title":"ますます","level":"N3","ko":"점점 더","id":480},{"title":"まま(に)","level":"N3","ko":"~한 채(로)","id":235},{"title":"まるで…ようだ","level":"N3","ko":"마치 ~인 것 같다","id":260},{"title":"み","level":"N3","ko":"~함 / ~기 (명사화)","id":462},{"title":"むしろ","level":"N3","ko":"오히려","id":459},{"title":"めったに〜ない","level":"N3","ko":"좀처럼 ~않다","id":271},{"title":"もしかしたら","level":"N3","ko":"어쩌면","id":284},{"title":"もしも～なら","level":"N3","ko":"만약 ~라면"},{"title":"もっとも","level":"N3","ko":"다만 / 하긴","id":466},{"title":"もの","level":"N3","ko":"~인걸 (이유)"},{"title":"ものだ","level":"N3","ko":"~인 법이다 / ~하곤 했다","id":223},{"title":"ような気がする","level":"N3","ko":"~인 듯한 기분이 든다","id":254},{"title":"わけがない","level":"N3","ko":"~할 리가 없다","id":253},{"title":"わけだ","level":"N3","ko":"~인 셈이다","id":229},{"title":"わけではない","level":"N3","ko":"~인 것은 아니다","id":241},{"title":"わけにはいかない","level":"N3","ko":"~할 수는 없다","id":266},{"title":"わざわざ","level":"N3","ko":"일부러","id":492},{"title":"をはじめ","level":"N3","ko":"~을 비롯해","id":263},{"title":"んじゃない","level":"N3","ko":"~하면 안 돼 / ~잖아","id":1081},{"title":"んだって","level":"N3","ko":"~래 / ~라더라","id":246},{"title":"一体","level":"N3","ko":"도대체","id":475},{"title":"一方だ","level":"N3","ko":"~하기만 한다","id":280},{"title":"一方で","level":"N3","ko":"한편으로","id":292},{"title":"上がる","level":"N3","ko":"다 ~하다 / 완성되다"},{"title":"上で","level":"N3","ko":"~한 후에 / ~하는 데 있어","id":198},{"title":"中","level":"N3","ko":"~중","id":197},{"title":"代わりに","level":"N3","ko":"~대신에","id":281},{"title":"全く～ない","level":"N3","ko":"전혀 ~않다","id":439},{"title":"再び","level":"N3","ko":"다시","id":465},{"title":"切る","level":"N3","ko":"다 ~하다 / 끝까지 ~하다","id":282},{"title":"切れない","level":"N3","ko":"다 ~할 수 없다","id":293},{"title":"別に〜ない","level":"N3","ko":"별로 ~않다","id":256},{"title":"前者は","level":"N3","ko":"전자는 ~ 후자는"},{"title":"割に","level":"N3","ko":"~에 비해","id":302},{"title":"即ち","level":"N3","ko":"즉","id":490},{"title":"却って","level":"N3","ko":"오히려","id":464},{"title":"又〜も","level":"N3","ko":"또 ~도 / 게다가","id":623},{"title":"合う","level":"N3","ko":"서로 ~하다","id":627},{"title":"同士","level":"N3","ko":"~끼리","id":656},{"title":"向き","level":"N3","ko":"~에 적합 / ~방향","id":261},{"title":"向け","level":"N3","ko":"~용 / ~대상","id":272},{"title":"左右する","level":"N3","ko":"좌우하다","id":677},{"title":"当たり","level":"N3","ko":"~당","id":461},{"title":"必ずしも","level":"N3","ko":"반드시 ~인 것은 아니다","id":486},{"title":"折角","level":"N3","ko":"모처럼","id":646},{"title":"最中に","level":"N3","ko":"한창 ~하는 중에","id":226},{"title":"次第","level":"N3","ko":"~하는 대로","id":300},{"title":"決して〜ない","level":"N3","ko":"결코 ~않다","id":268},{"title":"点","level":"N3","ko":"~점","id":644},{"title":"的","level":"N3","ko":"~적","id":443},{"title":"直ちに","level":"N3","ko":"즉시","id":473},{"title":"第一","level":"N3","ko":"첫째 / 우선","id":660},{"title":"考えられない","level":"N3","ko":"생각할 수 없다 / 있을 수 없다","id":661},{"title":"言うまでもない ②","level":"N3","ko":"말할 것도 없다","id":758},{"title":"込む ①","level":"N3","ko":"붐비다 / 가득 차다","id":664},{"title":"込む ②","level":"N3","ko":"~해 넣다 / 계속 ~하다","id":762},{"title":"連用形","level":"N3","ko":"연용형 (ます형 어간)","id":470},{"title":"遂に","level":"N3","ko":"마침내","id":485},{"title":"関係がある","level":"N3","ko":"~와 관계가 있다","id":642},{"title":"～(の)姿","level":"N3","ko":"~의 모습","id":669},{"title":"～かというと ①","level":"N3","ko":"왜 ~인가 하면","id":649},{"title":"～かというと ②","level":"N3","ko":"굳이 말하자면","id":755},{"title":"～ずつ","level":"N3","ko":"~씩","id":654},{"title":"～ても～なくても","level":"N3","ko":"~하든 안 하든","id":456},{"title":"～というのは事実だ","level":"N3","ko":"~라는 것은 사실이다","id":455},{"title":"～と言っても","level":"N3","ko":"~라고 해도","id":442},{"title":"～は～で有名","level":"N3","ko":"~은 ~로 유명하다","id":441},{"title":"～は～となっている","level":"N3","ko":"~은 ~로 되어 있다","id":636}];

  // ----------------------------------------------------------------------------
  // Build lookup indexes (by Bunpro grammar id, exact title, normalized title)
  // ----------------------------------------------------------------------------
  const byId = new Map();
  const byTitle = new Map();
  const byNorm = new Map();

  const normalize = (s) =>
    (s || '')
      .replace(/[〜～~・\s]/g, '')
      .replace(/（[^）]*）/g, '') // drop parenthetical furigana
      .replace(/\(.*?\)/g, '')
      .trim();

  for (const g of GLOSSES) {
    if (g.id != null) byId.set(String(g.id), g);
    if (g.title) {
      byTitle.set(g.title, g);
      byNorm.set(normalize(g.title), g);
    }
  }

  const log = (...a) => DEBUG && console.log('[BKG]', ...a);

  // ----------------------------------------------------------------------------
  // Styles
  // ----------------------------------------------------------------------------
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .${BOX_CLASS} {
        margin: 10px auto 0;
        max-width: 90%;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
        animation: bkgfade 180ms ease-out;
      }
      @keyframes bkgfade { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; } }
      .${BOX_CLASS} .bkg-gloss {
        font-size: 1.15rem;
        font-weight: 600;
        color: #2563eb;
      }
      .${BOX_CLASS} .bkg-gloss .bkg-label,
      .${BOX_CLASS} .bkg-sentence .bkg-label {
        font-weight: 500;
        color: #9ca3af;
        margin-right: 6px;
        font-size: 0.85em;
      }
      .${BOX_CLASS} .bkg-sentence {
        font-size: 1rem;
        color: #4b5563;
        margin-top: 4px;
      }
      @media (prefers-color-scheme: dark) {
        .${BOX_CLASS} .bkg-gloss { color: #60a5fa; }
        .${BOX_CLASS} .bkg-sentence { color: #cbd5e1; }
      }
    `;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ----------------------------------------------------------------------------
  // Translation (GM.xmlHttpRequest preferred for cross-origin; cached)
  // ----------------------------------------------------------------------------
  function loadCache() {
    try { return JSON.parse(localStorage.getItem(LS_CACHE) || '{}'); }
    catch { return {}; }
  }
  function saveCache(c) {
    try { localStorage.setItem(LS_CACHE, JSON.stringify(c)); } catch {}
  }

  function gmGet(url) {
    return new Promise((resolve, reject) => {
      const fn =
        (typeof GM !== 'undefined' && GM.xmlHttpRequest && GM.xmlHttpRequest.bind(GM)) ||
        (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest);
      if (fn) {
        fn({
          method: 'GET',
          url,
          onload: (r) => resolve(r.responseText),
          onerror: reject,
          ontimeout: reject,
        });
      } else {
        // Fallback (works if the endpoint sends permissive CORS headers).
        fetch(url).then((r) => r.text()).then(resolve).catch(reject);
      }
    });
  }

  async function translateToKorean(text) {
    if (!text) return '';
    const cache = loadCache();
    if (cache[text]) return cache[text];

    // 1) Google gtx endpoint
    try {
      const url =
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=ko&dt=t&q=' +
        encodeURIComponent(text);
      const raw = await gmGet(url);
      const data = JSON.parse(raw);
      const out = (data[0] || []).map((seg) => seg[0]).join('');
      if (out) {
        cache[text] = out;
        saveCache(cache);
        return out;
      }
    } catch (e) {
      log('gtx failed', e);
    }

    // 2) MyMemory fallback
    try {
      const url =
        'https://api.mymemory.translated.net/get?langpair=ja|ko&q=' +
        encodeURIComponent(text);
      const raw = await gmGet(url);
      const data = JSON.parse(raw);
      const out = data && data.responseData && data.responseData.translatedText;
      if (out) {
        cache[text] = out;
        saveCache(cache);
        return out;
      }
    } catch (e) {
      log('mymemory failed', e);
    }
    return '';
  }

  // ----------------------------------------------------------------------------
  // Read the current card: grammar point + sentence
  // ----------------------------------------------------------------------------

  // Candidate containers for the example/question sentence, most specific first.
  const SENTENCE_SELECTORS = [
    '.study-question-japanese',
    '.japanese-example-sentence',
    '[class*="study-question-japanese"]',
    '[class*="JapaneseSentence"]',
    '[class*="japanese-sentence"]',
  ];

  function findSentenceEl() {
    for (const sel of SENTENCE_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el;
    }
    return null;
  }

  // Extract readable Japanese text from a sentence node, dropping furigana
  // (rt), answer blanks, and collapsing ruby to its base text.
  function extractSentence(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('rt, rp').forEach((n) => n.remove());
    clone.querySelectorAll('.study-area-input, input').forEach((n) => n.remove());
    return clone.textContent.replace(/\s+/g, ' ').replace(/_+/g, '').trim();
  }

  // Identify the grammar point under test. Returns the matched gloss entry or null.
  function findGloss(sentenceEl) {
    // Strategy 1: data-gp-id on the highlighted grammar (most reliable).
    const ids = [];
    document
      .querySelectorAll('[data-gp-id]')
      .forEach((n) => ids.push(n.getAttribute('data-gp-id')));
    for (const id of ids) {
      if (byId.has(id)) return { entry: byId.get(id), via: 'id:' + id };
    }

    // Strategy 2: a link to the grammar point page; the last path segment is the
    // URL-encoded Japanese title.
    const link = document.querySelector('a[href*="/grammar_points/"]');
    if (link) {
      try {
        const seg = decodeURIComponent(link.getAttribute('href').split('/').pop().split('?')[0]);
        if (byTitle.has(seg)) return { entry: byTitle.get(seg), via: 'href:' + seg };
        if (byNorm.has(normalize(seg))) return { entry: byNorm.get(normalize(seg)), via: 'href~:' + seg };
      } catch {}
    }

    // Strategy 3: normalized text of the highlighted grammar span.
    const hi = document.querySelector('.gp-popout, [class*="gp-popout"], [class*="grammar-highlight"]');
    if (hi) {
      const t = normalize(hi.textContent);
      if (byNorm.has(t)) return { entry: byNorm.get(t), via: 'text:' + t };
    }

    // Record unknowns to help backfill the dictionary.
    if (ids.length) {
      try {
        const u = JSON.parse(localStorage.getItem(LS_UNKNOWN) || '{}');
        const t = sentenceEl ? extractSentence(sentenceEl).slice(0, 40) : '';
        ids.forEach((id) => { u[id] = t; });
        localStorage.setItem(LS_UNKNOWN, JSON.stringify(u));
      } catch {}
    }
    return null;
  }

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------
  let lastKey = '';

  async function render() {
    const sentenceEl = findSentenceEl();
    if (!sentenceEl) return;

    const sentence = extractSentence(sentenceEl);
    const match = findGloss(sentenceEl);

    // Key the render on grammar + sentence so we re-render on card change and
    // avoid duplicate work on unrelated DOM mutations.
    const key = (match ? match.entry.title : '?') + '|' + sentence;
    if (key === lastKey && document.querySelector('.' + BOX_CLASS)) return;
    lastKey = key;

    // Remove any previous box.
    document.querySelectorAll('.' + BOX_CLASS).forEach((n) => n.remove());

    if (!match && !SHOW_SENTENCE_TRANSLATION) return;

    log('grammar via', match && match.via, '| sentence:', sentence);

    ensureStyle();
    const box = document.createElement('div');
    box.className = BOX_CLASS;

    if (match) {
      const g = document.createElement('div');
      g.className = 'bkg-gloss';
      g.innerHTML = `<span class="bkg-label">한국어</span>${match.entry.ko}`;
      box.appendChild(g);
    }

    if (SHOW_SENTENCE_TRANSLATION && sentence) {
      const s = document.createElement('div');
      s.className = 'bkg-sentence';
      s.innerHTML = `<span class="bkg-label">번역</span><span class="bkg-trans">…</span>`;
      box.appendChild(s);
      translateToKorean(sentence).then((ko) => {
        const span = s.querySelector('.bkg-trans');
        if (span) span.textContent = ko || '(번역 실패)';
      });
    }

    // Insert just below the sentence container.
    const anchor = sentenceEl.closest('div') || sentenceEl;
    anchor.parentElement
      ? anchor.parentElement.insertBefore(box, anchor.nextSibling)
      : sentenceEl.appendChild(box);
  }

  // ----------------------------------------------------------------------------
  // Observe (Bunpro is a React SPA — cards swap without a full reload)
  // ----------------------------------------------------------------------------
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      try { render(); } catch (e) { log('render error', e); }
    }, 120);
  }

  const obs = new MutationObserver(schedule);
  obs.observe(document.body, { childList: true, subtree: true });
  schedule();

  log('Bunpro Korean Gloss loaded — dictionary entries:', GLOSSES.length);
})();
