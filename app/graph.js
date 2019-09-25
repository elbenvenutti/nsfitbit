import { me as device } from "device";
import dataProcessor from '../companion/dataprocessing';

// Screen dimension fallback for older firmware
if (!device.screen) device.screen = {
  width: 348,
  height: 250
};

const predColors = {
  "IOB": '#1e88e5',
  "COB": '#FB8C00FF',
  "ACOB":'#FB8C0080',
  "ZT": '#00d2d2',
  "UAM":'#c9bd60'
};

export default class Graph {

  constructor(id) {

    this._id = id;

    this._bg = this._id.getElementById("bg");

    this._sgvDots = this._id.getElementsByClassName("gval");
    this._predDots = this._id.getElementsByClassName("pred");
    
    this._treatments = this._id.getElementsByClassName("treatment");
    this._basals = this._id.getElementsByClassName("basal");

    this._tHighLine = this._id.getElementById("tHigh");
    this._tLowLine = this._id.getElementById("tLow");

  }

  getRenderCoords(settings) {
    const totalMinutes = (settings.cgmHours + settings.predictionHours) * 60;
    const graphWidth = this._id.width;
    const fiveMinWidth = graphWidth / (totalMinutes/5);
    const zeroPoint = Math.floor(graphWidth * (settings.cgmHours / (settings.cgmHours + settings.predictionHours)));
    return {fiveMinWidth, zeroPoint};
  }

  updateBasals(basals, settings) {
    console.log('Updating basals');

    const basalMaxHeight = 20;

    const now = Date.now();

    const {fiveMinWidth, zeroPoint} = this.getRenderCoords(settings);

    for (let i = 0; i < this._basals.length; i++) {
      this._basals[i].style.visibility = 'hidden';
      this._basals[i].style.fill = '#3366CC';
    }

    let totalWidth = 0;
    let maxVal = 0;

    for (let i = 0; i < basals.length; i++) {
      const b = basals[i];
      if (!b.absolute) continue;
      const abs = Number(b.absolute);
      if (abs > maxVal) maxVal = abs;
    }

    for (let i = 0; i < basals.length; i++) {
      if (!this._basals[i]) continue;

      const bar = this._basals[i];
      const b = basals[i];

      if (!b.duration) continue;  // Ok this is actually a problem

      const d = b.duration / (5 * 60 * 1000);

      bar.width = (fiveMinWidth * d);
      bar.x = zeroPoint - totalWidth;

      totalWidth += bar.width;
      if (totalWidth >= zeroPoint) break;
      bar.style.visibility = 'visible';
      if (bar.x < 36) bar.style.visibility = 'hidden';

      const abs = Number(b.absolute) || 0;

      bar.height = basalMaxHeight * Math.max(0,(abs / maxVal));

      bar.y = this._id.height - bar.height;

    }

  }

  updateTreatments(treatments, settings) {
    console.log("Updating treatment bars...");

    const now = Date.now();

    const {fiveMinWidth, zeroPoint} = this.getRenderCoords(settings);

    for (let i = 0; i < this._treatments.length; i++) {
      this._treatments[i].style.visibility = 'hidden';
    }

    for (let i = 0; i < treatments.length; i++) {
      if (!this._treatments[i]) continue;
      const bar = this._treatments[i];
      const t = treatments[i];
      const timeDelta = (now - t.date) / (5 * 60 * 1000);

      bar.x = zeroPoint - (fiveMinWidth * timeDelta);

      if (t.carbs) {
        bar.height = 10 + (t.carbs / 2);
        bar.style.fill = 'green';
      }
      if (t.insulin) {
        bar.height = 10 + (t.insulin * 5);
        bar.style.fill = 'red';
      }
      bar.y = this._id.height - bar.height - 20;
      bar.style.visibility = 'visible';

      if (bar.x < 36) bar.style.visibility = 'hidden';

    }

  }

  update(data, settings) {

    console.log("Updating glucose dots...");

    const SGVArray = data.BGD;

    const {fiveMinWidth, zeroPoint} = this.getRenderCoords(settings);

    for (let i = 0; i < this._sgvDots.length; i++) {
      this._sgvDots[i].style.visibility = 'hidden';
    }

    for (let i = 0; i < this._predDots.length; i++) {
      this._predDots[i].style.visibility = 'hidden';
    }

    const sgvLow = 36;
    let sgvHigh = 0;
    const glucoseHeight = 98;

    for (let i = 0; i < SGVArray.length; i++) {
      const sgv = SGVArray[i];
      if (sgv.sgv > sgvHigh) sgvHigh = sgv.sgv;
    }

    const yScale = (sgvHigh - sgvLow) / this._id.height;

    const range = sgvHigh - sgvLow;

    function getYFromSgv(sgv) {
      const v = sgv-sgvLow;
      const r = v/range;
      return Math.floor(glucoseHeight * (1-r)) + 1;
    }

    const now = Date.now();

    for (let i = 0; i < SGVArray.length; i++) {
      if (!this._sgvDots[i]) continue;
      const dot = this._sgvDots[i];
      const sgv = SGVArray[i];

      const timeDeltaMinutes = (now - sgv.date) / (60 * 1000);
      if (timeDelta > settings.cgmHours*60) continue;

      const timeDelta = timeDeltaMinutes / 5;
      dot.cy = getYFromSgv(Number(sgv.sgv));
      dot.cx = Math.floor(zeroPoint - (timeDelta * fiveMinWidth));

      dot.style.fill = 'green';
      if (sgv.sgv >= settings.highThreshold || sgv.sgv <= settings.lowThreshold) {
        dot.style.fill = 'red';
      }
      dot.style.visibility = 'visible';
    }


    if (data.openapsPreds && settings.predictionHours > 0) {

      console.log('Drawing predictions');

      const d = data.openapsPreds;

      if (!d.moment) {
        console.log('No pred data');
      } else {

      let predPointer = 0;
      const predStartMoment = new Date(d.moment).getTime();
      const predStartPixel = zeroPoint + (predStartMoment - now) / (5*60*1000) * fiveMinWidth;
      const predElementsToUse = settings.predictionHours * 12;

      for (let predType in d) {
        console.log('Drawing ' + predType + ' predictions');

        const predictions = d[predType];
        const color = predColors[predType];

        if (!color) continue;

        for (let i = 0; i < predElementsToUse; i++) {
          const dot = this._predDots[predPointer];
          const sgv = predictions[i];
          predPointer += 1;
          if (!sgv || !dot) continue;
          dot.cy = Math.max(0,getYFromSgv(Number(sgv)));
          dot.cx = predStartPixel + i * fiveMinWidth;
          dot.style.fill = color;
          dot.style.visibility = 'visible';
        }

      }
    }
  }

    const highLineY = getYFromSgv(settings.highThreshold);
    const lowLineY = getYFromSgv(settings.lowThreshold);

    this._tHighLine.y1 = highLineY;
    this._tHighLine.y2 = highLineY;
    this._tLowLine.y1 = lowLineY;
    this._tLowLine.y2 = lowLineY;

    this._tHighLine.style.visibility = 'visible'; 

    if (highLineY < 0) { this._tHighLine.style.visibility = 'hidden'; }

  }
};