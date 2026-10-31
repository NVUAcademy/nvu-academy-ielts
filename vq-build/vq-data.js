/* Bộ từ Vocab Quest cho IELTS 13 (Pre-IELTS) và IELTS 14 (Intermediate).
   Mỗi dòng: word | nghĩa | ví dụ | chủ đề | loại từ | collocation.
   Trong collocation, phần đặt trong [ ] là "bạn đồng hành" (partner) dùng cho câu hỏi hoàn thành collocation. */

const PRE = [
  /* Day 1 · Trial Lesson 1 handout */
  'nurture|nuôi dưỡng, vun đắp|Parents should nurture a close relationship with their children.|Trial 1 · Family & friends|verb|nurture a [relationship]',
  'sibling rivalry|sự ganh đua giữa anh chị em|Sibling rivalry is common when two children are close in age.|Trial 1 · Family & friends|noun phrase|[intense] sibling rivalry',
  'on good terms with|có quan hệ tốt với|I am still on good terms with my old classmates.|Trial 1 · Family & friends|phrase|[stay] on good terms with a friend',
  'drift apart|dần xa cách nhau|Many friends drift apart once they start working.|Trial 1 · Family & friends|phrasal verb|old [friends] drift apart',
  'mutual|chung, lẫn nhau (cả hai phía)|A good friendship is based on mutual trust.|Trial 1 · Family & friends|adjective|mutual [respect]',
  'generation gap|khoảng cách thế hệ|There is a generation gap between me and my grandfather.|Trial 1 · Family & friends|noun phrase|[bridge] the generation gap',
  'bond|mối gắn kết|Cooking together strengthens the bond between us.|Trial 1 · Family & friends|noun|[strengthen] the bond between us',
  'fall out with|cãi nhau, bất hòa với|I try not to fall out with my roommate over the housework.|Trial 1 · Family & friends|phrasal verb|fall out with a friend [over money]',
  'confide in|tâm sự với, thổ lộ với|I often confide in my best friend when I feel stressed.|Trial 1 · Family & friends|phrasal verb|confide in a [close friend]',
  'supportive|ủng hộ, luôn động viên|My parents are very supportive of my studies.|Trial 1 · Family & friends|adjective|supportive [of my studies]',

  /* Day 2 · Trial Lesson 2 handout */
  'hectic|bận rộn, tất bật|My weekdays are hectic, so I rarely cook.|Trial 2 · Busy lives|adjective|a hectic [schedule]',
  'commute|đi lại hằng ngày (đi làm, đi học)|My daily commute takes about twenty minutes.|Trial 2 · Busy lives|verb / noun|a [long] commute',
  'unwind|thư giãn sau khi mệt|I unwind by listening to music.|Trial 2 · Busy lives|verb|unwind [after work]',
  'juggle|xoay xở nhiều việc cùng lúc|I juggle my part-time job and my studies.|Trial 2 · Busy lives|verb|juggle work and [study]',
  'prioritise|ưu tiên|I prioritise my homework over social media.|Trial 2 · Busy lives|verb|prioritise [tasks]',
  'procrastinate|trì hoãn, chần chừ|I tend to procrastinate when I have to write.|Trial 2 · Busy lives|verb|[tend to] procrastinate',
  'productive|hiệu quả, làm được nhiều việc|I feel most productive in the morning.|Trial 2 · Busy lives|adjective|a productive [day]',
  'a sense of achievement|cảm giác thành tựu|Finishing a project gives me a sense of achievement.|Trial 2 · Busy lives|noun phrase|[feel] a sense of achievement',
  'be packed with|chật kín, đầy ắp|My Tuesdays will be packed with lessons, so I rarely rest.|Trial 2 · Busy lives|phrase|be packed with [lessons]',
  'keep up with|theo kịp, cập nhật|I try to keep up with my homework every day.|Trial 2 · Busy lives|phrasal verb|keep up with the [news]',

  /* Day 3 · Family relationships (mở rộng) */
  'get along with|hòa thuận với|I get along with my cousins very well.|Family relationships|phrasal verb|get along with [everyone]',
  'look up to|ngưỡng mộ, kính trọng|I look up to my older sister because she works hard.|Family relationships|phrasal verb|look up to a [role model]',
  'take after|giống (bố mẹ) về tính cách hoặc ngoại hình|I take after my mother: we are both patient.|Family relationships|phrasal verb|take after your [mother]',
  'close-knit|gắn bó, đoàn kết|We are a close-knit family and eat dinner together.|Family relationships|adjective|a close-knit [family]',
  'extended family|đại gia đình (cả ông bà, cô dì chú bác)|My extended family gets together at Tet.|Family relationships|noun phrase|a [large] extended family',
  'childhood|tuổi thơ|I had a happy childhood in the countryside.|Family relationships|noun|a [happy] childhood',
  'upbringing|sự nuôi dạy|My strict upbringing taught me to be responsible.|Family relationships|noun|a [strict] upbringing',
  'relative|họ hàng, người thân|I visit my relatives at the weekend.|Family relationships|noun|a [close] relative',
  'argument|cuộc cãi vã|We had an argument about money.|Family relationships|noun|[have] an argument',
  'apologise|xin lỗi|He apologised for being late.|Family relationships|verb|apologise [for being late]',

  /* Day 4 · Daily life */
  'deadline|hạn chót|I have a deadline on Friday.|Daily life|noun|[meet] a deadline',
  'routine|thói quen hằng ngày|My morning routine is very simple.|Daily life|noun|a [daily] routine',
  'schedule|lịch trình, thời gian biểu|I have a tight schedule this week.|Daily life|noun|a [tight] schedule',
  'stressed out|rất căng thẳng|I feel stressed out before exams.|Daily life|adjective|[feel] stressed out',
  'exhausted|kiệt sức|I was exhausted after the long trip.|Daily life|adjective|[completely] exhausted',
  'spare time|thời gian rảnh|I read books in my spare time.|Daily life|noun|[have] some spare time',
  'get up early|dậy sớm|I get up early to go jogging.|Daily life|phrase|[have to] get up early',
  'take a break|nghỉ giải lao|I take a break every hour.|Daily life|phrase|take a break [from studying]',
  'time management|quản lý thời gian|Good time management helps me finish on time.|Daily life|noun phrase|[good] time management',
  'work-life balance|cân bằng giữa công việc và cuộc sống|It is hard to keep a work-life balance when you study and work.|Daily life|noun phrase|[keep] a work-life balance',

  /* Day 5 · How things are made */
  'raw material|nguyên liệu thô|Wood is the raw material for paper.|How things are made|noun phrase|[natural] raw materials',
  'process|quy trình|The process of making juice has six stages.|How things are made|noun|the [production] process',
  'stage|giai đoạn, bước|The first stage is picking the oranges.|How things are made|noun|the [final] stage',
  'squeeze|vắt, ép|The oranges are squeezed by a machine.|How things are made|verb|squeeze [oranges]',
  'filter|lọc|The juice is filtered to remove the seeds.|How things are made|verb|filter the [juice]',
  'heat|đun nóng|The milk is heated in a large pot.|How things are made|verb|heat the [milk]',
  'pour|rót, đổ|The juice is poured into bottles.|How things are made|verb|pour [into bottles]',
  'deliver|giao hàng, vận chuyển|The bottles are delivered to shops by truck.|How things are made|verb|deliver [goods]',
  'equipment|thiết bị, dụng cụ|A large metal pot is the main equipment.|How things are made|noun|a piece of [metal] equipment',
  'remove|loại bỏ, lấy ra|The seeds are removed by a filter.|How things are made|verb|remove the [seeds]',

  /* Day 6 · Friends and feelings */
  'hang out with|đi chơi, tụ tập với|I hang out with my friends at the weekend.|Friends & feelings|phrasal verb|hang out with [close friends]',
  'keep in touch|giữ liên lạc|I keep in touch with my old friends online.|Friends & feelings|phrase|keep in touch [with old friends]',
  'reliable|đáng tin cậy|A good friend should be reliable.|Friends & feelings|adjective|a reliable [friend]',
  'generous|hào phóng|My uncle is very generous with his time.|Friends & feelings|adjective|generous [with money]',
  'share|chia sẻ, cùng làm|We share the housework.|Friends & feelings|verb|share the [housework]',
  'advice|lời khuyên|My grandmother always gives me good advice.|Friends & feelings|noun|[give] advice',
  'respect|tôn trọng; sự tôn trọng|I respect my teachers.|Friends & feelings|verb / noun|[show] respect',
  'trust|tin tưởng; niềm tin|You can trust me with a secret.|Friends & feelings|verb / noun|[build] trust',
  'miss|nhớ (ai đó)|I miss my family when I study away from home.|Friends & feelings|verb|miss my [family]',
  'get married|kết hôn|My cousin will get married next year.|Friends & feelings|phrase|get married [young]'
];

const INTER = [
  /* Day 1 · I1 handout */
  'residential area|khu dân cư|I live in a quiet residential area.|I1 · Where you live|noun phrase|a [quiet] residential area',
  'high-rise apartment block|chung cư cao tầng|I live in a high-rise apartment block.|I1 · Where you live|noun phrase|[live in] a high-rise apartment block',
  'densely populated|đông dân cư|Hà Nội is densely populated.|I1 · Where you live|adjective|a densely populated [city]',
  'local amenities|tiện ích xung quanh|I have easy access to local amenities.|I1 · Where you live|noun phrase|[easy access to] local amenities',
  'green spaces|không gian xanh|There is a lack of green spaces here.|I1 · Where you live|noun phrase|a [lack of] green spaces',
  'urban sprawl|đô thị lan rộng|Urban sprawl is replacing farmland.|I1 · Where you live|noun phrase|[rapid] urban sprawl',
  'run-down|xuống cấp, tồi tàn|The old market looks quite run-down.|I1 · Where you live|adjective|a run-down [building]',
  'a vibrant atmosphere|không khí sôi động|The night market has a vibrant atmosphere.|I1 · Where you live|noun phrase|[have] a vibrant atmosphere',
  'a sense of community|tình làng nghĩa xóm, tinh thần cộng đồng|A sense of community makes people feel safe in the village.|I1 · Where you live|noun phrase|[foster] a sense of community',
  'neighbourhood|khu phố, vùng lân cận|I grew up in a friendly neighbourhood.|I1 · Where you live|noun|a [friendly] neighbourhood',

  /* Day 2 · Housing */
  'detached house|nhà riêng biệt (không chung tường)|They live in a detached house with a big garden.|I1 · Housing|noun phrase|a [spacious] detached house',
  'semi-detached|nhà liền kề một bên|We rent a semi-detached house near the park.|I1 · Housing|adjective|a semi-detached [house]',
  'spacious|rộng rãi|The living room is spacious and bright.|I1 · Housing|adjective|a spacious [living room]',
  'cramped|chật chội|Our first flat was small and cramped.|I1 · Housing|adjective|cramped [conditions]',
  'furnished|có sẵn nội thất|I rent a fully furnished flat.|I1 · Housing|adjective|a [fully] furnished flat',
  'landlord|chủ nhà (cho thuê)|My landlord raised the rent last month.|I1 · Housing|noun|[ask] the landlord for help',
  'mortgage|khoản vay thế chấp mua nhà|They are still paying off a mortgage.|I1 · Housing|noun|[pay off] a mortgage',
  'rent|tiền thuê nhà; thuê|The rent in the city centre is very high.|I1 · Housing|noun / verb|[pay] the rent',
  'property|bất động sản|Property prices have risen sharply.|I1 · Housing|noun|[invest in] property',
  'suburb|ngoại ô, vùng ngoại thành|Many families have moved to the suburbs.|I1 · Housing|noun|[move to] the suburbs',

  /* Day 3 · City problems */
  'traffic congestion|ùn tắc giao thông|Traffic congestion is a serious problem in big cities.|I1 · City problems|noun phrase|[reduce] traffic congestion',
  'air pollution|ô nhiễm không khí|Air pollution is getting worse every year.|I1 · City problems|noun phrase|[cause] air pollution',
  'noise pollution|ô nhiễm tiếng ồn|Noise pollution makes it hard to sleep.|I1 · City problems|noun phrase|[suffer from] noise pollution',
  'overcrowded|quá đông đúc|The buses are overcrowded in the rush hour.|I1 · City problems|adjective|an overcrowded [city]',
  'rush hour|giờ cao điểm|I avoid travelling during rush hour.|I1 · City problems|noun phrase|[avoid] the rush hour',
  'public transport|giao thông công cộng|Public transport is cheap and convenient.|I1 · City problems|noun phrase|[use] public transport',
  'pedestrian|người đi bộ|The street is full of pedestrians.|I1 · City problems|noun|a pedestrian [crossing]',
  'road network|mạng lưới đường bộ|The city has an extensive road network.|I1 · City problems|noun phrase|an [extensive] road network',
  'housing shortage|tình trạng thiếu nhà ở|A housing shortage pushes rents up.|I1 · City problems|noun phrase|[tackle] the housing shortage',
  'cost of living|chi phí sinh hoạt|The cost of living is high in the city centre.|I1 · City problems|noun phrase|the [rising] cost of living',

  /* Day 4 · Infrastructure and planning */
  'infrastructure|cơ sở hạ tầng|The government invests in infrastructure.|I1 · Infrastructure|noun|[improve] the infrastructure',
  'city centre|trung tâm thành phố|The city centre is full of shops and cafés.|I1 · Infrastructure|noun phrase|a [bustling] city centre',
  'skyscraper|nhà chọc trời|A new skyscraper is being built near the river.|I1 · Infrastructure|noun|[construct] a skyscraper',
  'bridge|cây cầu|A new bridge connects the two districts.|I1 · Infrastructure|noun|[cross] a bridge',
  'construction|sự xây dựng|Construction of the metro line started last year.|I1 · Infrastructure|noun|be [under] construction',
  'renovate|cải tạo, sửa chữa lớn|They renovated the old house last year.|I1 · Infrastructure|verb|renovate an [old building]',
  'demolish|phá dỡ|The old factory was demolished last year.|I1 · Infrastructure|verb|demolish an [old factory]',
  'landmark|địa danh, công trình biểu tượng|The tower is a famous landmark.|I1 · Infrastructure|noun|a [famous] landmark',
  'heritage|di sản|The old quarter is part of our cultural heritage.|I1 · Infrastructure|noun|[preserve] our heritage',
  'urban planning|quy hoạch đô thị|Good urban planning can reduce traffic.|I1 · Infrastructure|noun phrase|[effective] urban planning',

  /* Day 5 · Community and facilities */
  'facilities|cơ sở vật chất, tiện nghi|The district has excellent sports facilities.|I1 · Community|noun|[sports] facilities',
  'public library|thư viện công cộng|I study at the public library on weekends.|I1 · Community|noun phrase|[visit] the public library',
  'community centre|trung tâm sinh hoạt cộng đồng|The community centre runs free English classes.|I1 · Community|noun phrase|a [local] community centre',
  'shopping mall|trung tâm thương mại|Young people like hanging out in the shopping mall.|I1 · Community|noun phrase|a [huge] shopping mall',
  'playground|sân chơi|There is a playground for children near my house.|I1 · Community|noun|a [children\'s] playground',
  'convenient|thuận tiện|The location is convenient for shopping.|I1 · Community|adjective|a convenient [location]',
  'accessible|dễ tiếp cận, dễ đến|The museum is accessible by bus.|I1 · Community|adjective|[easily] accessible',
  'neighbour|hàng xóm|My neighbours are very friendly.|I1 · Community|noun|[friendly] neighbours',
  'social life|đời sống xã hội|There is a lively social life in this city.|I1 · Community|noun phrase|a [lively] social life',
  'resident|cư dân|Local residents complained about the noise.|I1 · Community|noun|[local] residents',

  /* Day 6 · Describing a place */
  'peaceful|yên bình|My village is peaceful and quiet.|I1 · Describing a place|adjective|a peaceful [neighbourhood]',
  'bustling|nhộn nhịp, tấp nập|The market is bustling with shoppers.|I1 · Describing a place|adjective|a bustling [market]',
  'picturesque|đẹp như tranh|We visited a picturesque village in the mountains.|I1 · Describing a place|adjective|a picturesque [village]',
  'modernise|hiện đại hóa|The city plans to modernise its transport system.|I1 · Describing a place|verb|modernise the [transport system]',
  'expand|mở rộng|The city is expanding rapidly.|I1 · Describing a place|verb|expand [rapidly]',
  'relocate|chuyển đến nơi khác sinh sống, làm việc|Many people relocate to find better jobs.|I1 · Describing a place|verb|relocate [to a new city]',
  'commute|đi lại hằng ngày (đi làm, đi học)|My commute takes forty minutes by bus.|I1 · Describing a place|verb / noun|a [long] commute',
  'within walking distance|trong khoảng cách đi bộ|My school is within walking distance.|I1 · Describing a place|phrase|[be] within walking distance of the station',
  'lively|sôi nổi, sống động|The streets are lively at night.|I1 · Describing a place|adjective|a lively [street]',
  'dense|dày đặc|The area has dense traffic in the morning.|I1 · Describing a place|adjective|dense [traffic]'
];

function toTsv(list, cols) {
  const head = ['Word', 'Meaning', 'Example', 'Topic', 'Type', 'Collocation'].slice(0, cols || 6).join('\t');
  const rows = list.map(l => {
    const p = l.split('|');
    if (p.length !== (cols || 6)) throw new Error('Bad row (' + p.length + ' cols): ' + l);
    return p.map(x => x.trim()).join('\t');
  });
  return head + '\n' + rows.join('\n');
}

module.exports = { PRE, INTER, toTsv };
