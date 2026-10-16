window.BETCHEAP_CONFIG = {
  mode: 'live',
  enablePartnerLinks: false, // Activate only after market/channel review and routing tests.
  telegramHandle: null,
  liveEndpoint: '/.netlify/functions/odds',
  oneXBetEndpoint: '/.netlify/functions/onexbet',
  // Add ONLY approved affiliate/deep links here. A plain bookmaker URL is not an affiliate link.
  // Optional region-specific form:
  // affiliateLinks: { betfair_ex_eu: 'https://approved-tracking-url.example' }
  affiliateLinks: {onexbet:'https://reffpa.com/L?tag=d_6184138m_97c_1x_5888061&site=6184138&ad=97&r=mainpage'},
  affiliatePrograms: {
    onexbet: {label:'1xBet', status:'pending_market_confirmation', regions:['eu'], markets:{}, allowedHosts:['reffpa.com'], promoCode:'1x_5888061', linkType:'landing'},
    betfair_ex_eu: {label:'Betfair', regions:['eu','uk']},
    betsson: {label:'Betsson', status:'pending_link_and_markets', regions:['eu'], markets:{}, allowedHosts:[]},
    nordicbet: {label:'NordicBet', regions:['eu']},
    leovegas: {label:'LeoVegas', regions:['eu','uk']},
    williamhill: {label:'William Hill', regions:['eu','uk']},
    unibet_eu: {label:'Unibet', regions:['eu']},
    unibet_uk: {label:'Unibet', regions:['uk']}
  },
  leagues: [
    ['soccer_epl','Premier League'],['soccer_spain_la_liga','La Liga'],
    ['soccer_uefa_champs_league','Champions League'],['soccer_italy_serie_a','Serie A'],
    ['soccer_germany_bundesliga','Bundesliga'],['soccer_france_ligue_one','Ligue 1']
  ]
};
