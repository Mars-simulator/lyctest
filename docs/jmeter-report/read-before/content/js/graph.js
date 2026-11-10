/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
$(document).ready(function() {

    $(".click-title").mouseenter( function(    e){
        e.preventDefault();
        this.style.cursor="pointer";
    });
    $(".click-title").mousedown( function(event){
        event.preventDefault();
    });

    // Ugly code while this script is shared among several pages
    try{
        refreshHitsPerSecond(true);
    } catch(e){}
    try{
        refreshResponseTimeOverTime(true);
    } catch(e){}
    try{
        refreshResponseTimePercentiles();
    } catch(e){}
});


var responseTimePercentilesInfos = {
        data: {"result": {"minY": 141.0, "minX": 0.0, "maxY": 1615.0, "series": [{"data": [[0.0, 141.0], [0.1, 141.0], [0.2, 151.0], [0.3, 151.0], [0.4, 154.0], [0.5, 154.0], [0.6, 161.0], [0.7, 161.0], [0.8, 165.0], [0.9, 165.0], [1.0, 181.0], [1.1, 181.0], [1.2, 182.0], [1.3, 190.0], [1.4, 190.0], [1.5, 192.0], [1.6, 192.0], [1.7, 198.0], [1.8, 198.0], [1.9, 201.0], [2.0, 201.0], [2.1, 206.0], [2.2, 206.0], [2.3, 219.0], [2.4, 249.0], [2.5, 249.0], [2.6, 249.0], [2.7, 249.0], [2.8, 249.0], [2.9, 249.0], [3.0, 254.0], [3.1, 254.0], [3.2, 261.0], [3.3, 261.0], [3.4, 267.0], [3.5, 267.0], [3.6, 283.0], [3.7, 295.0], [3.8, 295.0], [3.9, 297.0], [4.0, 297.0], [4.1, 299.0], [4.2, 299.0], [4.3, 300.0], [4.4, 300.0], [4.5, 302.0], [4.6, 302.0], [4.7, 304.0], [4.8, 305.0], [4.9, 305.0], [5.0, 308.0], [5.1, 308.0], [5.2, 310.0], [5.3, 310.0], [5.4, 313.0], [5.5, 313.0], [5.6, 316.0], [5.7, 316.0], [5.8, 316.0], [5.9, 316.0], [6.0, 326.0], [6.1, 326.0], [6.2, 326.0], [6.3, 329.0], [6.4, 329.0], [6.5, 330.0], [6.6, 330.0], [6.7, 332.0], [6.8, 332.0], [6.9, 333.0], [7.0, 333.0], [7.1, 333.0], [7.2, 333.0], [7.3, 333.0], [7.4, 334.0], [7.5, 334.0], [7.6, 334.0], [7.7, 334.0], [7.8, 336.0], [7.9, 336.0], [8.0, 336.0], [8.1, 336.0], [8.2, 336.0], [8.3, 336.0], [8.4, 339.0], [8.5, 341.0], [8.6, 341.0], [8.7, 343.0], [8.8, 343.0], [8.9, 344.0], [9.0, 344.0], [9.1, 347.0], [9.2, 347.0], [9.3, 347.0], [9.4, 347.0], [9.5, 347.0], [9.6, 350.0], [9.7, 350.0], [9.8, 351.0], [9.9, 351.0], [10.0, 351.0], [10.1, 351.0], [10.2, 351.0], [10.3, 351.0], [10.4, 353.0], [10.5, 353.0], [10.6, 356.0], [10.7, 356.0], [10.8, 357.0], [10.9, 359.0], [11.0, 359.0], [11.1, 360.0], [11.2, 360.0], [11.3, 360.0], [11.4, 360.0], [11.5, 361.0], [11.6, 361.0], [11.7, 361.0], [11.8, 361.0], [11.9, 361.0], [12.0, 362.0], [12.1, 362.0], [12.2, 362.0], [12.3, 362.0], [12.4, 363.0], [12.5, 363.0], [12.6, 364.0], [12.7, 364.0], [12.8, 365.0], [12.9, 365.0], [13.0, 365.0], [13.1, 368.0], [13.2, 368.0], [13.3, 368.0], [13.4, 368.0], [13.5, 368.0], [13.6, 368.0], [13.7, 369.0], [13.8, 369.0], [13.9, 370.0], [14.0, 370.0], [14.1, 371.0], [14.2, 371.0], [14.3, 371.0], [14.4, 371.0], [14.5, 371.0], [14.6, 372.0], [14.7, 372.0], [14.8, 372.0], [14.9, 372.0], [15.0, 374.0], [15.1, 374.0], [15.2, 374.0], [15.3, 374.0], [15.4, 375.0], [15.5, 377.0], [15.6, 377.0], [15.7, 377.0], [15.8, 377.0], [15.9, 377.0], [16.0, 377.0], [16.1, 382.0], [16.2, 382.0], [16.3, 382.0], [16.4, 382.0], [16.5, 383.0], [16.6, 383.0], [16.7, 386.0], [16.8, 388.0], [16.9, 388.0], [17.0, 389.0], [17.1, 389.0], [17.2, 389.0], [17.3, 389.0], [17.4, 390.0], [17.5, 390.0], [17.6, 390.0], [17.7, 390.0], [17.8, 391.0], [17.9, 391.0], [18.0, 391.0], [18.1, 392.0], [18.2, 392.0], [18.3, 392.0], [18.4, 392.0], [18.5, 393.0], [18.6, 393.0], [18.7, 393.0], [18.8, 393.0], [18.9, 395.0], [19.0, 395.0], [19.1, 397.0], [19.2, 397.0], [19.3, 397.0], [19.4, 397.0], [19.5, 397.0], [19.6, 397.0], [19.7, 397.0], [19.8, 399.0], [19.9, 399.0], [20.0, 399.0], [20.1, 399.0], [20.2, 399.0], [20.3, 400.0], [20.4, 400.0], [20.5, 402.0], [20.6, 402.0], [20.7, 403.0], [20.8, 403.0], [20.9, 404.0], [21.0, 404.0], [21.1, 404.0], [21.2, 404.0], [21.3, 405.0], [21.4, 405.0], [21.5, 405.0], [21.6, 405.0], [21.7, 405.0], [21.8, 406.0], [21.9, 406.0], [22.0, 406.0], [22.1, 406.0], [22.2, 406.0], [22.3, 406.0], [22.4, 407.0], [22.5, 407.0], [22.6, 408.0], [22.7, 409.0], [22.8, 409.0], [22.9, 409.0], [23.0, 409.0], [23.1, 409.0], [23.2, 409.0], [23.3, 409.0], [23.4, 409.0], [23.5, 411.0], [23.6, 411.0], [23.7, 413.0], [23.8, 413.0], [23.9, 415.0], [24.0, 415.0], [24.1, 415.0], [24.2, 415.0], [24.3, 415.0], [24.4, 415.0], [24.5, 415.0], [24.6, 415.0], [24.7, 415.0], [24.8, 416.0], [24.9, 416.0], [25.0, 416.0], [25.1, 417.0], [25.2, 417.0], [25.3, 417.0], [25.4, 417.0], [25.5, 417.0], [25.6, 417.0], [25.7, 418.0], [25.8, 418.0], [25.9, 418.0], [26.0, 418.0], [26.1, 419.0], [26.2, 419.0], [26.3, 419.0], [26.4, 420.0], [26.5, 420.0], [26.6, 421.0], [26.7, 421.0], [26.8, 421.0], [26.9, 421.0], [27.0, 422.0], [27.1, 422.0], [27.2, 423.0], [27.3, 423.0], [27.4, 423.0], [27.5, 424.0], [27.6, 424.0], [27.7, 424.0], [27.8, 424.0], [27.9, 425.0], [28.0, 425.0], [28.1, 425.0], [28.2, 425.0], [28.3, 427.0], [28.4, 427.0], [28.5, 427.0], [28.6, 428.0], [28.7, 428.0], [28.8, 429.0], [28.9, 429.0], [29.0, 430.0], [29.1, 430.0], [29.2, 430.0], [29.3, 430.0], [29.4, 430.0], [29.5, 430.0], [29.6, 431.0], [29.7, 431.0], [29.8, 431.0], [29.9, 431.0], [30.0, 431.0], [30.1, 432.0], [30.2, 432.0], [30.3, 433.0], [30.4, 433.0], [30.5, 433.0], [30.6, 433.0], [30.7, 434.0], [30.8, 434.0], [30.9, 435.0], [31.0, 435.0], [31.1, 435.0], [31.2, 435.0], [31.3, 435.0], [31.4, 437.0], [31.5, 437.0], [31.6, 441.0], [31.7, 441.0], [31.8, 442.0], [31.9, 442.0], [32.0, 442.0], [32.1, 442.0], [32.2, 443.0], [32.3, 444.0], [32.4, 444.0], [32.5, 444.0], [32.6, 444.0], [32.7, 444.0], [32.8, 444.0], [32.9, 445.0], [33.0, 445.0], [33.1, 447.0], [33.2, 447.0], [33.3, 448.0], [33.4, 448.0], [33.5, 448.0], [33.6, 448.0], [33.7, 448.0], [33.8, 449.0], [33.9, 449.0], [34.0, 449.0], [34.1, 449.0], [34.2, 450.0], [34.3, 450.0], [34.4, 450.0], [34.5, 450.0], [34.6, 450.0], [34.7, 452.0], [34.8, 452.0], [34.9, 452.0], [35.0, 452.0], [35.1, 452.0], [35.2, 452.0], [35.3, 454.0], [35.4, 454.0], [35.5, 455.0], [35.6, 455.0], [35.7, 455.0], [35.8, 456.0], [35.9, 456.0], [36.0, 456.0], [36.1, 456.0], [36.2, 457.0], [36.3, 457.0], [36.4, 458.0], [36.5, 458.0], [36.6, 458.0], [36.7, 458.0], [36.8, 458.0], [36.9, 458.0], [37.0, 459.0], [37.1, 459.0], [37.2, 459.0], [37.3, 459.0], [37.4, 459.0], [37.5, 459.0], [37.6, 459.0], [37.7, 460.0], [37.8, 460.0], [37.9, 460.0], [38.0, 460.0], [38.1, 460.0], [38.2, 461.0], [38.3, 461.0], [38.4, 461.0], [38.5, 461.0], [38.6, 461.0], [38.7, 461.0], [38.8, 462.0], [38.9, 462.0], [39.0, 463.0], [39.1, 463.0], [39.2, 463.0], [39.3, 464.0], [39.4, 464.0], [39.5, 464.0], [39.6, 464.0], [39.7, 467.0], [39.8, 467.0], [39.9, 467.0], [40.0, 467.0], [40.1, 467.0], [40.2, 467.0], [40.3, 467.0], [40.4, 467.0], [40.5, 468.0], [40.6, 469.0], [40.7, 469.0], [40.8, 469.0], [40.9, 469.0], [41.0, 469.0], [41.1, 469.0], [41.2, 470.0], [41.3, 470.0], [41.4, 473.0], [41.5, 473.0], [41.6, 474.0], [41.7, 475.0], [41.8, 475.0], [41.9, 476.0], [42.0, 476.0], [42.1, 476.0], [42.2, 476.0], [42.3, 476.0], [42.4, 476.0], [42.5, 477.0], [42.6, 477.0], [42.7, 478.0], [42.8, 478.0], [42.9, 479.0], [43.0, 480.0], [43.1, 480.0], [43.2, 480.0], [43.3, 480.0], [43.4, 480.0], [43.5, 480.0], [43.6, 481.0], [43.7, 481.0], [43.8, 484.0], [43.9, 484.0], [44.0, 484.0], [44.1, 484.0], [44.2, 484.0], [44.3, 485.0], [44.4, 485.0], [44.5, 485.0], [44.6, 485.0], [44.7, 486.0], [44.8, 486.0], [44.9, 486.0], [45.0, 486.0], [45.1, 487.0], [45.2, 487.0], [45.3, 490.0], [45.4, 492.0], [45.5, 492.0], [45.6, 495.0], [45.7, 495.0], [45.8, 495.0], [45.9, 495.0], [46.0, 496.0], [46.1, 496.0], [46.2, 497.0], [46.3, 497.0], [46.4, 499.0], [46.5, 499.0], [46.6, 499.0], [46.7, 500.0], [46.8, 500.0], [46.9, 501.0], [47.0, 501.0], [47.1, 502.0], [47.2, 502.0], [47.3, 502.0], [47.4, 502.0], [47.5, 503.0], [47.6, 503.0], [47.7, 503.0], [47.8, 504.0], [47.9, 504.0], [48.0, 505.0], [48.1, 505.0], [48.2, 507.0], [48.3, 507.0], [48.4, 509.0], [48.5, 509.0], [48.6, 509.0], [48.7, 509.0], [48.8, 509.0], [48.9, 512.0], [49.0, 512.0], [49.1, 514.0], [49.2, 514.0], [49.3, 515.0], [49.4, 515.0], [49.5, 516.0], [49.6, 516.0], [49.7, 517.0], [49.8, 517.0], [49.9, 517.0], [50.0, 517.0], [50.1, 519.0], [50.2, 520.0], [50.3, 520.0], [50.4, 521.0], [50.5, 521.0], [50.6, 522.0], [50.7, 522.0], [50.8, 524.0], [50.9, 524.0], [51.0, 525.0], [51.1, 525.0], [51.2, 525.0], [51.3, 525.0], [51.4, 525.0], [51.5, 527.0], [51.6, 527.0], [51.7, 528.0], [51.8, 528.0], [51.9, 529.0], [52.0, 529.0], [52.1, 531.0], [52.2, 531.0], [52.3, 532.0], [52.4, 532.0], [52.5, 532.0], [52.6, 534.0], [52.7, 534.0], [52.8, 534.0], [52.9, 534.0], [53.0, 535.0], [53.1, 535.0], [53.2, 536.0], [53.3, 536.0], [53.4, 536.0], [53.5, 536.0], [53.6, 536.0], [53.7, 537.0], [53.8, 537.0], [53.9, 537.0], [54.0, 537.0], [54.1, 537.0], [54.2, 537.0], [54.3, 538.0], [54.4, 538.0], [54.5, 538.0], [54.6, 538.0], [54.7, 538.0], [54.8, 539.0], [54.9, 539.0], [55.0, 539.0], [55.1, 539.0], [55.2, 540.0], [55.3, 540.0], [55.4, 540.0], [55.5, 540.0], [55.6, 540.0], [55.7, 540.0], [55.8, 540.0], [55.9, 540.0], [56.0, 542.0], [56.1, 542.0], [56.2, 542.0], [56.3, 544.0], [56.4, 544.0], [56.5, 544.0], [56.6, 544.0], [56.7, 545.0], [56.8, 545.0], [56.9, 546.0], [57.0, 546.0], [57.1, 546.0], [57.2, 547.0], [57.3, 547.0], [57.4, 548.0], [57.5, 548.0], [57.6, 549.0], [57.7, 549.0], [57.8, 549.0], [57.9, 549.0], [58.0, 550.0], [58.1, 550.0], [58.2, 550.0], [58.3, 550.0], [58.4, 551.0], [58.5, 554.0], [58.6, 554.0], [58.7, 554.0], [58.8, 554.0], [58.9, 554.0], [59.0, 554.0], [59.1, 554.0], [59.2, 554.0], [59.3, 555.0], [59.4, 555.0], [59.5, 555.0], [59.6, 555.0], [59.7, 555.0], [59.8, 556.0], [59.9, 556.0], [60.0, 557.0], [60.1, 557.0], [60.2, 557.0], [60.3, 557.0], [60.4, 558.0], [60.5, 558.0], [60.6, 559.0], [60.7, 559.0], [60.8, 559.0], [60.9, 560.0], [61.0, 560.0], [61.1, 562.0], [61.2, 562.0], [61.3, 567.0], [61.4, 567.0], [61.5, 568.0], [61.6, 568.0], [61.7, 569.0], [61.8, 569.0], [61.9, 570.0], [62.0, 570.0], [62.1, 570.0], [62.2, 571.0], [62.3, 571.0], [62.4, 571.0], [62.5, 571.0], [62.6, 573.0], [62.7, 573.0], [62.8, 574.0], [62.9, 574.0], [63.0, 575.0], [63.1, 575.0], [63.2, 575.0], [63.3, 575.0], [63.4, 575.0], [63.5, 576.0], [63.6, 576.0], [63.7, 579.0], [63.8, 579.0], [63.9, 580.0], [64.0, 580.0], [64.1, 580.0], [64.2, 580.0], [64.3, 583.0], [64.4, 584.0], [64.5, 584.0], [64.6, 585.0], [64.7, 585.0], [64.8, 586.0], [64.9, 586.0], [65.0, 586.0], [65.1, 586.0], [65.2, 588.0], [65.3, 588.0], [65.4, 588.0], [65.5, 589.0], [65.6, 589.0], [65.7, 592.0], [65.8, 592.0], [65.9, 593.0], [66.0, 593.0], [66.1, 593.0], [66.2, 593.0], [66.3, 593.0], [66.4, 593.0], [66.5, 594.0], [66.6, 594.0], [66.7, 594.0], [66.8, 594.0], [66.9, 594.0], [67.0, 595.0], [67.1, 595.0], [67.2, 595.0], [67.3, 595.0], [67.4, 595.0], [67.5, 595.0], [67.6, 596.0], [67.7, 596.0], [67.8, 597.0], [67.9, 597.0], [68.0, 597.0], [68.1, 597.0], [68.2, 597.0], [68.3, 598.0], [68.4, 598.0], [68.5, 598.0], [68.6, 598.0], [68.7, 598.0], [68.8, 598.0], [68.9, 599.0], [69.0, 599.0], [69.1, 600.0], [69.2, 601.0], [69.3, 601.0], [69.4, 602.0], [69.5, 602.0], [69.6, 604.0], [69.7, 604.0], [69.8, 606.0], [69.9, 606.0], [70.0, 607.0], [70.1, 607.0], [70.2, 610.0], [70.3, 612.0], [70.4, 612.0], [70.5, 612.0], [70.6, 612.0], [70.7, 613.0], [70.8, 613.0], [70.9, 613.0], [71.0, 613.0], [71.1, 614.0], [71.2, 614.0], [71.3, 614.0], [71.4, 614.0], [71.5, 615.0], [71.6, 615.0], [71.7, 615.0], [71.8, 617.0], [71.9, 617.0], [72.0, 619.0], [72.1, 619.0], [72.2, 619.0], [72.3, 619.0], [72.4, 621.0], [72.5, 621.0], [72.6, 623.0], [72.7, 624.0], [72.8, 624.0], [72.9, 626.0], [73.0, 626.0], [73.1, 626.0], [73.2, 626.0], [73.3, 627.0], [73.4, 627.0], [73.5, 628.0], [73.6, 628.0], [73.7, 629.0], [73.8, 629.0], [73.9, 630.0], [74.0, 630.0], [74.1, 630.0], [74.2, 631.0], [74.3, 631.0], [74.4, 633.0], [74.5, 633.0], [74.6, 633.0], [74.7, 633.0], [74.8, 634.0], [74.9, 634.0], [75.0, 636.0], [75.1, 637.0], [75.2, 637.0], [75.3, 640.0], [75.4, 640.0], [75.5, 640.0], [75.6, 640.0], [75.7, 643.0], [75.8, 643.0], [75.9, 643.0], [76.0, 643.0], [76.1, 644.0], [76.2, 644.0], [76.3, 644.0], [76.4, 644.0], [76.5, 644.0], [76.6, 644.0], [76.7, 644.0], [76.8, 644.0], [76.9, 644.0], [77.0, 646.0], [77.1, 646.0], [77.2, 647.0], [77.3, 647.0], [77.4, 647.0], [77.5, 648.0], [77.6, 648.0], [77.7, 648.0], [77.8, 648.0], [77.9, 649.0], [78.0, 649.0], [78.1, 650.0], [78.2, 650.0], [78.3, 652.0], [78.4, 652.0], [78.5, 654.0], [78.6, 654.0], [78.7, 654.0], [78.8, 655.0], [78.9, 655.0], [79.0, 655.0], [79.1, 655.0], [79.2, 656.0], [79.3, 656.0], [79.4, 659.0], [79.5, 659.0], [79.6, 660.0], [79.7, 660.0], [79.8, 663.0], [79.9, 664.0], [80.0, 664.0], [80.1, 666.0], [80.2, 666.0], [80.3, 670.0], [80.4, 670.0], [80.5, 677.0], [80.6, 677.0], [80.7, 679.0], [80.8, 679.0], [80.9, 681.0], [81.0, 684.0], [81.1, 684.0], [81.2, 687.0], [81.3, 687.0], [81.4, 687.0], [81.5, 687.0], [81.6, 689.0], [81.7, 689.0], [81.8, 690.0], [81.9, 690.0], [82.0, 694.0], [82.1, 694.0], [82.2, 694.0], [82.3, 698.0], [82.4, 698.0], [82.5, 699.0], [82.6, 699.0], [82.7, 701.0], [82.8, 701.0], [82.9, 703.0], [83.0, 703.0], [83.1, 705.0], [83.2, 705.0], [83.3, 708.0], [83.4, 709.0], [83.5, 709.0], [83.6, 713.0], [83.7, 713.0], [83.8, 716.0], [83.9, 716.0], [84.0, 717.0], [84.1, 717.0], [84.2, 717.0], [84.3, 717.0], [84.4, 725.0], [84.5, 725.0], [84.6, 730.0], [84.7, 736.0], [84.8, 736.0], [84.9, 738.0], [85.0, 738.0], [85.1, 741.0], [85.2, 741.0], [85.3, 746.0], [85.4, 746.0], [85.5, 746.0], [85.6, 746.0], [85.7, 746.0], [85.8, 752.0], [85.9, 752.0], [86.0, 754.0], [86.1, 754.0], [86.2, 755.0], [86.3, 755.0], [86.4, 756.0], [86.5, 756.0], [86.6, 757.0], [86.7, 757.0], [86.8, 761.0], [86.9, 761.0], [87.0, 767.0], [87.1, 768.0], [87.2, 768.0], [87.3, 769.0], [87.4, 769.0], [87.5, 770.0], [87.6, 770.0], [87.7, 771.0], [87.8, 771.0], [87.9, 773.0], [88.0, 773.0], [88.1, 777.0], [88.2, 778.0], [88.3, 778.0], [88.4, 784.0], [88.5, 784.0], [88.6, 784.0], [88.7, 784.0], [88.8, 791.0], [88.9, 791.0], [89.0, 800.0], [89.1, 800.0], [89.2, 803.0], [89.3, 803.0], [89.4, 803.0], [89.5, 805.0], [89.6, 805.0], [89.7, 806.0], [89.8, 806.0], [89.9, 808.0], [90.0, 808.0], [90.1, 808.0], [90.2, 808.0], [90.3, 813.0], [90.4, 813.0], [90.5, 813.0], [90.6, 817.0], [90.7, 817.0], [90.8, 828.0], [90.9, 828.0], [91.0, 828.0], [91.1, 828.0], [91.2, 842.0], [91.3, 842.0], [91.4, 849.0], [91.5, 849.0], [91.6, 850.0], [91.7, 850.0], [91.8, 850.0], [91.9, 851.0], [92.0, 851.0], [92.1, 866.0], [92.2, 866.0], [92.3, 867.0], [92.4, 867.0], [92.5, 872.0], [92.6, 872.0], [92.7, 887.0], [92.8, 887.0], [92.9, 894.0], [93.0, 898.0], [93.1, 898.0], [93.2, 899.0], [93.3, 899.0], [93.4, 902.0], [93.5, 902.0], [93.6, 906.0], [93.7, 906.0], [93.8, 920.0], [93.9, 920.0], [94.0, 921.0], [94.1, 925.0], [94.2, 925.0], [94.3, 931.0], [94.4, 931.0], [94.5, 932.0], [94.6, 932.0], [94.7, 934.0], [94.8, 934.0], [94.9, 939.0], [95.0, 939.0], [95.1, 947.0], [95.2, 947.0], [95.3, 950.0], [95.4, 951.0], [95.5, 951.0], [95.6, 951.0], [95.7, 951.0], [95.8, 952.0], [95.9, 952.0], [96.0, 953.0], [96.1, 953.0], [96.2, 953.0], [96.3, 953.0], [96.4, 954.0], [96.5, 961.0], [96.6, 961.0], [96.7, 964.0], [96.8, 964.0], [96.9, 970.0], [97.0, 970.0], [97.1, 972.0], [97.2, 972.0], [97.3, 973.0], [97.4, 973.0], [97.5, 980.0], [97.6, 980.0], [97.7, 984.0], [97.8, 990.0], [97.9, 990.0], [98.0, 994.0], [98.1, 994.0], [98.2, 1013.0], [98.3, 1013.0], [98.4, 1013.0], [98.5, 1013.0], [98.6, 1014.0], [98.7, 1014.0], [98.8, 1017.0], [98.9, 1022.0], [99.0, 1022.0], [99.1, 1032.0], [99.2, 1032.0], [99.3, 1050.0], [99.4, 1050.0], [99.5, 1072.0], [99.6, 1072.0], [99.7, 1138.0], [99.8, 1138.0], [99.9, 1615.0]], "isOverall": false, "label": "GET /ledger/transactions", "isController": false}], "supportsControllersDiscrimination": true, "maxX": 100.0, "title": "Response Time Percentiles"}},
        getOptions: function() {
            return {
                series: {
                    points: { show: false }
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimePercentiles'
                },
                xaxis: {
                    tickDecimals: 1,
                    axisLabel: "Percentiles",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Percentile value in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : %x.2 percentile was %y ms"
                },
                selection: { mode: "xy" },
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimePercentiles"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimesPercentiles"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimesPercentiles"), dataset, prepareOverviewOptions(options));
        }
};

/**
 * @param elementId Id of element where we display message
 */
function setEmptyGraph(elementId) {
    $(function() {
        $(elementId).text("No graph series with filter="+seriesFilter);
    });
}

// Response times percentiles
function refreshResponseTimePercentiles() {
    var infos = responseTimePercentilesInfos;
    prepareSeries(infos.data);
    if(infos.data.result.series.length == 0) {
        setEmptyGraph("#bodyResponseTimePercentiles");
        return;
    }
    if (isGraph($("#flotResponseTimesPercentiles"))){
        infos.createGraph();
    } else {
        var choiceContainer = $("#choicesResponseTimePercentiles");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimesPercentiles", "#overviewResponseTimesPercentiles");
        $('#bodyResponseTimePercentiles .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var responseTimeDistributionInfos = {
        data: {"result": {"minY": 1.0, "minX": 100.0, "maxY": 143.0, "series": [{"data": [[1100.0, 1.0], [300.0, 87.0], [600.0, 74.0], [700.0, 34.0], [200.0, 13.0], [100.0, 10.0], [400.0, 143.0], [800.0, 24.0], [1600.0, 1.0], [900.0, 26.0], [500.0, 121.0], [1000.0, 8.0]], "isOverall": false, "label": "GET /ledger/transactions", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 100, "maxX": 1600.0, "title": "Response Time Distribution"}},
        getOptions: function() {
            var granularity = this.data.result.granularity;
            return {
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimeDistribution'
                },
                xaxis:{
                    axisLabel: "Response times in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of responses",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                bars : {
                    show: true,
                    barWidth: this.data.result.granularity
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: function(label, xval, yval, flotItem){
                        return yval + " responses for " + label + " were between " + xval + " and " + (xval + granularity) + " ms";
                    }
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimeDistribution"), prepareData(data.result.series, $("#choicesResponseTimeDistribution")), options);
        }

};

// Response time distribution
function refreshResponseTimeDistribution() {
    var infos = responseTimeDistributionInfos;
    prepareSeries(infos.data);
    if(infos.data.result.series.length == 0) {
        setEmptyGraph("#bodyResponseTimeDistribution");
        return;
    }
    if (isGraph($("#flotResponseTimeDistribution"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesResponseTimeDistribution");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        $('#footerResponseTimeDistribution .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var syntheticResponseTimeDistributionInfos = {
        data: {"result": {"minY": 1.0, "minX": 0.0, "ticks": [[0, "Requests having \nresponse time <= 500ms"], [1, "Requests having \nresponse time > 500ms and <= 1,500ms"], [2, "Requests having \nresponse time > 1,500ms"], [3, "Requests in error"]], "maxY": 287.0, "series": [{"data": [[0.0, 254.0]], "color": "#9ACD32", "isOverall": false, "label": "Requests having \nresponse time <= 500ms", "isController": false}, {"data": [[1.0, 287.0]], "color": "yellow", "isOverall": false, "label": "Requests having \nresponse time > 500ms and <= 1,500ms", "isController": false}, {"data": [[2.0, 1.0]], "color": "orange", "isOverall": false, "label": "Requests having \nresponse time > 1,500ms", "isController": false}, {"data": [], "color": "#FF6347", "isOverall": false, "label": "Requests in error", "isController": false}], "supportsControllersDiscrimination": false, "maxX": 2.0, "title": "Synthetic Response Times Distribution"}},
        getOptions: function() {
            return {
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendSyntheticResponseTimeDistribution'
                },
                xaxis:{
                    axisLabel: "Response times ranges",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                    tickLength:0,
                    min:-0.5,
                    max:3.5
                },
                yaxis: {
                    axisLabel: "Number of responses",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                bars : {
                    show: true,
                    align: "center",
                    barWidth: 0.25,
                    fill:.75
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: function(label, xval, yval, flotItem){
                        return yval + " " + label;
                    }
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var options = this.getOptions();
            prepareOptions(options, data);
            options.xaxis.ticks = data.result.ticks;
            $.plot($("#flotSyntheticResponseTimeDistribution"), prepareData(data.result.series, $("#choicesSyntheticResponseTimeDistribution")), options);
        }

};

// Response time distribution
function refreshSyntheticResponseTimeDistribution() {
    var infos = syntheticResponseTimeDistributionInfos;
    prepareSeries(infos.data, true);
    if (isGraph($("#flotSyntheticResponseTimeDistribution"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesSyntheticResponseTimeDistribution");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        $('#footerSyntheticResponseTimeDistribution .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var activeThreadsOverTimeInfos = {
        data: {"result": {"minY": 19.231818181818177, "minX": 1.79421666E12, "maxY": 19.41304347826087, "series": [{"data": [[1.79421666E12, 19.231818181818177], [1.79421672E12, 19.41304347826087]], "isOverall": false, "label": "read-threads", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.79421672E12, "title": "Active Threads Over Time"}},
        getOptions: function() {
            return {
                series: {
                    stack: true,
                    lines: {
                        show: true,
                        fill: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of active threads",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 6,
                    show: true,
                    container: '#legendActiveThreadsOverTime'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                selection: {
                    mode: 'xy'
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : At %x there were %y active threads"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesActiveThreadsOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotActiveThreadsOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewActiveThreadsOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Active Threads Over Time
function refreshActiveThreadsOverTime(fixTimestamps) {
    var infos = activeThreadsOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotActiveThreadsOverTime"))) {
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesActiveThreadsOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotActiveThreadsOverTime", "#overviewActiveThreadsOverTime");
        $('#footerActiveThreadsOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var timeVsThreadsInfos = {
        data: {"result": {"minY": 275.5, "minX": 1.0, "maxY": 633.0, "series": [{"data": [[8.0, 275.5], [2.0, 571.0], [9.0, 361.0], [11.0, 351.6], [12.0, 287.2], [3.0, 549.0], [13.0, 461.0], [14.0, 422.0], [15.0, 337.66666666666663], [16.0, 327.2], [4.0, 602.0], [1.0, 601.0], [17.0, 534.0], [18.0, 412.0], [19.0, 402.0], [20.0, 559.8895582329316], [5.0, 633.0], [6.0, 460.0], [7.0, 478.0]], "isOverall": false, "label": "GET /ledger/transactions", "isController": false}, {"data": [[19.339483394833962, 545.4243542435422]], "isOverall": false, "label": "GET /ledger/transactions-Aggregated", "isController": false}], "supportsControllersDiscrimination": true, "maxX": 20.0, "title": "Time VS Threads"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    axisLabel: "Number of active threads",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average response times in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: { noColumns: 2,show: true, container: '#legendTimeVsThreads' },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s: At %x.2 active threads, Average response time was %y.2 ms"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesTimeVsThreads"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotTimesVsThreads"), dataset, options);
            // setup overview
            $.plot($("#overviewTimesVsThreads"), dataset, prepareOverviewOptions(options));
        }
};

// Time vs threads
function refreshTimeVsThreads(){
    var infos = timeVsThreadsInfos;
    prepareSeries(infos.data);
    if(infos.data.result.series.length == 0) {
        setEmptyGraph("#bodyTimeVsThreads");
        return;
    }
    if(isGraph($("#flotTimesVsThreads"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesTimeVsThreads");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotTimesVsThreads", "#overviewTimesVsThreads");
        $('#footerTimeVsThreads .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var bytesThroughputOverTimeInfos = {
        data : {"result": {"minY": 1742.6166666666666, "minX": 1.79421666E12, "maxY": 32863.01666666667, "series": [{"data": [[1.79421666E12, 22448.7], [1.79421672E12, 32863.01666666667]], "isOverall": false, "label": "Bytes received per second", "isController": false}, {"data": [[1.79421666E12, 1742.6166666666666], [1.79421672E12, 2550.883333333333]], "isOverall": false, "label": "Bytes sent per second", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.79421672E12, "title": "Bytes Throughput Over Time"}},
        getOptions : function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity) ,
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Bytes / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendBytesThroughputOverTime'
                },
                selection: {
                    mode: "xy"
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y"
                }
            };
        },
        createGraph : function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesBytesThroughputOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotBytesThroughputOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewBytesThroughputOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Bytes throughput Over Time
function refreshBytesThroughputOverTime(fixTimestamps) {
    var infos = bytesThroughputOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotBytesThroughputOverTime"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesBytesThroughputOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotBytesThroughputOverTime", "#overviewBytesThroughputOverTime");
        $('#footerBytesThroughputOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var responseTimesOverTimeInfos = {
        data: {"result": {"minY": 531.6055900621119, "minX": 1.79421666E12, "maxY": 565.65, "series": [{"data": [[1.79421666E12, 565.65], [1.79421672E12, 531.6055900621119]], "isOverall": false, "label": "GET /ledger/transactions", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.79421672E12, "title": "Response Time Over Time"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average response time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average response time was %y ms"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Response Times Over Time
function refreshResponseTimeOverTime(fixTimestamps) {
    var infos = responseTimesOverTimeInfos;
    prepareSeries(infos.data);
    if(infos.data.result.series.length == 0) {
        setEmptyGraph("#bodyResponseTimeOverTime");
        return;
    }
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotResponseTimesOverTime"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesResponseTimesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimesOverTime", "#overviewResponseTimesOverTime");
        $('#footerResponseTimesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var latenciesOverTimeInfos = {
        data: {"result": {"minY": 531.4658385093171, "minX": 1.79421666E12, "maxY": 565.3545454545452, "series": [{"data": [[1.79421666E12, 565.3545454545452], [1.79421672E12, 531.4658385093171]], "isOverall": false, "label": "GET /ledger/transactions", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.79421672E12, "title": "Latencies Over Time"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average response latencies in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendLatenciesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average latency was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesLatenciesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotLatenciesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewLatenciesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Latencies Over Time
function refreshLatenciesOverTime(fixTimestamps) {
    var infos = latenciesOverTimeInfos;
    prepareSeries(infos.data);
    if(infos.data.result.series.length == 0) {
        setEmptyGraph("#bodyLatenciesOverTime");
        return;
    }
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotLatenciesOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesLatenciesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotLatenciesOverTime", "#overviewLatenciesOverTime");
        $('#footerLatenciesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var connectTimeOverTimeInfos = {
        data: {"result": {"minY": 0.0, "minX": 1.79421666E12, "maxY": 0.9272727272727282, "series": [{"data": [[1.79421666E12, 0.9272727272727282], [1.79421672E12, 0.0]], "isOverall": false, "label": "GET /ledger/transactions", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.79421672E12, "title": "Connect Time Over Time"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getConnectTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average Connect Time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendConnectTimeOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average connect time was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesConnectTimeOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotConnectTimeOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewConnectTimeOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Connect Time Over Time
function refreshConnectTimeOverTime(fixTimestamps) {
    var infos = connectTimeOverTimeInfos;
    prepareSeries(infos.data);
    if(infos.data.result.series.length == 0) {
        setEmptyGraph("#bodyConnectTimeOverTime");
        return;
    }
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotConnectTimeOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesConnectTimeOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotConnectTimeOverTime", "#overviewConnectTimeOverTime");
        $('#footerConnectTimeOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var responseTimePercentilesOverTimeInfos = {
        data: {"result": {"minY": 141.0, "minX": 1.79421666E12, "maxY": 1615.0, "series": [{"data": [[1.79421666E12, 1615.0], [1.79421672E12, 1050.0]], "isOverall": false, "label": "Max", "isController": false}, {"data": [[1.79421666E12, 141.0], [1.79421672E12, 302.0]], "isOverall": false, "label": "Min", "isController": false}, {"data": [[1.79421666E12, 924.6], [1.79421672E12, 740.0999999999999]], "isOverall": false, "label": "90th percentile", "isController": false}, {"data": [[1.79421666E12, 1124.1399999999994], [1.79421672E12, 1003.8799999999992]], "isOverall": false, "label": "99th percentile", "isController": false}, {"data": [[1.79421666E12, 544.5], [1.79421672E12, 492.5]], "isOverall": false, "label": "Median", "isController": false}, {"data": [[1.79421666E12, 979.6499999999999], [1.79421672E12, 816.3999999999999]], "isOverall": false, "label": "95th percentile", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.79421672E12, "title": "Response Time Percentiles Over Time (successful requests only)"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true,
                        fill: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Response Time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimePercentilesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Response time was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimePercentilesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimePercentilesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimePercentilesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Response Time Percentiles Over Time
function refreshResponseTimePercentilesOverTime(fixTimestamps) {
    var infos = responseTimePercentilesOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotResponseTimePercentilesOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesResponseTimePercentilesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimePercentilesOverTime", "#overviewResponseTimePercentilesOverTime");
        $('#footerResponseTimePercentilesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var responseTimeVsRequestInfos = {
    data: {"result": {"minY": 380.0, "minX": 19.0, "maxY": 746.0, "series": [{"data": [[32.0, 613.5], [38.0, 523.0], [19.0, 571.0], [41.0, 484.0], [43.0, 467.0], [47.0, 421.0], [48.0, 402.0], [26.0, 663.0], [27.0, 746.0], [28.0, 696.0], [30.0, 380.0]], "isOverall": false, "label": "Successes", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 1000, "maxX": 48.0, "title": "Response Time Vs Request"}},
    getOptions: function() {
        return {
            series: {
                lines: {
                    show: false
                },
                points: {
                    show: true
                }
            },
            xaxis: {
                axisLabel: "Global number of requests per second",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            yaxis: {
                axisLabel: "Median Response Time in ms",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            legend: {
                noColumns: 2,
                show: true,
                container: '#legendResponseTimeVsRequest'
            },
            selection: {
                mode: 'xy'
            },
            grid: {
                hoverable: true // IMPORTANT! this is needed for tooltip to work
            },
            tooltip: true,
            tooltipOpts: {
                content: "%s : Median response time at %x req/s was %y ms"
            },
            colors: ["#9ACD32", "#FF6347"]
        };
    },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesResponseTimeVsRequest"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotResponseTimeVsRequest"), dataset, options);
        // setup overview
        $.plot($("#overviewResponseTimeVsRequest"), dataset, prepareOverviewOptions(options));

    }
};

// Response Time vs Request
function refreshResponseTimeVsRequest() {
    var infos = responseTimeVsRequestInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimeVsRequest"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesResponseTimeVsRequest");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimeVsRequest", "#overviewResponseTimeVsRequest");
        $('#footerResponseRimeVsRequest .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var latenciesVsRequestInfos = {
    data: {"result": {"minY": 380.0, "minX": 19.0, "maxY": 746.0, "series": [{"data": [[32.0, 613.0], [38.0, 523.0], [19.0, 571.0], [41.0, 484.0], [43.0, 466.0], [47.0, 421.0], [48.0, 401.5], [26.0, 663.0], [27.0, 746.0], [28.0, 695.5], [30.0, 380.0]], "isOverall": false, "label": "Successes", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 1000, "maxX": 48.0, "title": "Latencies Vs Request"}},
    getOptions: function() {
        return{
            series: {
                lines: {
                    show: false
                },
                points: {
                    show: true
                }
            },
            xaxis: {
                axisLabel: "Global number of requests per second",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            yaxis: {
                axisLabel: "Median Latency in ms",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            legend: { noColumns: 2,show: true, container: '#legendLatencyVsRequest' },
            selection: {
                mode: 'xy'
            },
            grid: {
                hoverable: true // IMPORTANT! this is needed for tooltip to work
            },
            tooltip: true,
            tooltipOpts: {
                content: "%s : Median Latency time at %x req/s was %y ms"
            },
            colors: ["#9ACD32", "#FF6347"]
        };
    },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesLatencyVsRequest"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotLatenciesVsRequest"), dataset, options);
        // setup overview
        $.plot($("#overviewLatenciesVsRequest"), dataset, prepareOverviewOptions(options));
    }
};

// Latencies vs Request
function refreshLatenciesVsRequest() {
        var infos = latenciesVsRequestInfos;
        prepareSeries(infos.data);
        if(isGraph($("#flotLatenciesVsRequest"))){
            infos.createGraph();
        }else{
            var choiceContainer = $("#choicesLatencyVsRequest");
            createLegend(choiceContainer, infos);
            infos.createGraph();
            setGraphZoomable("#flotLatenciesVsRequest", "#overviewLatenciesVsRequest");
            $('#footerLatenciesVsRequest .legendColorBox > div').each(function(i){
                $(this).clone().prependTo(choiceContainer.find("li").eq(i));
            });
        }
};

var hitsPerSecondInfos = {
        data: {"result": {"minY": 4.0, "minX": 1.79421666E12, "maxY": 5.033333333333333, "series": [{"data": [[1.79421666E12, 4.0], [1.79421672E12, 5.033333333333333]], "isOverall": false, "label": "hitsPerSecond", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.79421672E12, "title": "Hits Per Second"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of hits / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendHitsPerSecond"
                },
                selection: {
                    mode : 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y.2 hits/sec"
                }
            };
        },
        createGraph: function createGraph() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesHitsPerSecond"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotHitsPerSecond"), dataset, options);
            // setup overview
            $.plot($("#overviewHitsPerSecond"), dataset, prepareOverviewOptions(options));
        }
};

// Hits per second
function refreshHitsPerSecond(fixTimestamps) {
    var infos = hitsPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if (isGraph($("#flotHitsPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesHitsPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotHitsPerSecond", "#overviewHitsPerSecond");
        $('#footerHitsPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var codesPerSecondInfos = {
        data: {"result": {"minY": 3.6666666666666665, "minX": 1.79421666E12, "maxY": 5.366666666666666, "series": [{"data": [[1.79421666E12, 3.6666666666666665], [1.79421672E12, 5.366666666666666]], "isOverall": false, "label": "200", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.79421672E12, "title": "Codes Per Second"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of responses / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendCodesPerSecond"
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "Number of Response Codes %s at %x was %y.2 responses / sec"
                }
            };
        },
    createGraph: function() {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesCodesPerSecond"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotCodesPerSecond"), dataset, options);
        // setup overview
        $.plot($("#overviewCodesPerSecond"), dataset, prepareOverviewOptions(options));
    }
};

// Codes per second
function refreshCodesPerSecond(fixTimestamps) {
    var infos = codesPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotCodesPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesCodesPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotCodesPerSecond", "#overviewCodesPerSecond");
        $('#footerCodesPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var transactionsPerSecondInfos = {
        data: {"result": {"minY": 3.6666666666666665, "minX": 1.79421666E12, "maxY": 5.366666666666666, "series": [{"data": [[1.79421666E12, 3.6666666666666665], [1.79421672E12, 5.366666666666666]], "isOverall": false, "label": "GET /ledger/transactions-success", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.79421672E12, "title": "Transactions Per Second"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of transactions / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendTransactionsPerSecond"
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y transactions / sec"
                }
            };
        },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesTransactionsPerSecond"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotTransactionsPerSecond"), dataset, options);
        // setup overview
        $.plot($("#overviewTransactionsPerSecond"), dataset, prepareOverviewOptions(options));
    }
};

// Transactions per second
function refreshTransactionsPerSecond(fixTimestamps) {
    var infos = transactionsPerSecondInfos;
    prepareSeries(infos.data);
    if(infos.data.result.series.length == 0) {
        setEmptyGraph("#bodyTransactionsPerSecond");
        return;
    }
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotTransactionsPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesTransactionsPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotTransactionsPerSecond", "#overviewTransactionsPerSecond");
        $('#footerTransactionsPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var totalTPSInfos = {
        data: {"result": {"minY": 3.6666666666666665, "minX": 1.79421666E12, "maxY": 5.366666666666666, "series": [{"data": [[1.79421666E12, 3.6666666666666665], [1.79421672E12, 5.366666666666666]], "isOverall": false, "label": "Transaction-success", "isController": false}, {"data": [], "isOverall": false, "label": "Transaction-failure", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.79421672E12, "title": "Total Transactions Per Second"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: getTimeFormat(this.data.result.granularity),
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of transactions / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendTotalTPS"
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y transactions / sec"
                },
                colors: ["#9ACD32", "#FF6347"]
            };
        },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesTotalTPS"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotTotalTPS"), dataset, options);
        // setup overview
        $.plot($("#overviewTotalTPS"), dataset, prepareOverviewOptions(options));
    }
};

// Total Transactions per second
function refreshTotalTPS(fixTimestamps) {
    var infos = totalTPSInfos;
    // We want to ignore seriesFilter
    prepareSeries(infos.data, false, true);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 28800000);
    }
    if(isGraph($("#flotTotalTPS"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesTotalTPS");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotTotalTPS", "#overviewTotalTPS");
        $('#footerTotalTPS .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

// Collapse the graph matching the specified DOM element depending the collapsed
// status
function collapse(elem, collapsed){
    if(collapsed){
        $(elem).parent().find(".fa-chevron-up").removeClass("fa-chevron-up").addClass("fa-chevron-down");
    } else {
        $(elem).parent().find(".fa-chevron-down").removeClass("fa-chevron-down").addClass("fa-chevron-up");
        if (elem.id == "bodyBytesThroughputOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshBytesThroughputOverTime(true);
            }
            document.location.href="#bytesThroughputOverTime";
        } else if (elem.id == "bodyLatenciesOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshLatenciesOverTime(true);
            }
            document.location.href="#latenciesOverTime";
        } else if (elem.id == "bodyCustomGraph") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshCustomGraph(true);
            }
            document.location.href="#responseCustomGraph";
        } else if (elem.id == "bodyConnectTimeOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshConnectTimeOverTime(true);
            }
            document.location.href="#connectTimeOverTime";
        } else if (elem.id == "bodyResponseTimePercentilesOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimePercentilesOverTime(true);
            }
            document.location.href="#responseTimePercentilesOverTime";
        } else if (elem.id == "bodyResponseTimeDistribution") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimeDistribution();
            }
            document.location.href="#responseTimeDistribution" ;
        } else if (elem.id == "bodySyntheticResponseTimeDistribution") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshSyntheticResponseTimeDistribution();
            }
            document.location.href="#syntheticResponseTimeDistribution" ;
        } else if (elem.id == "bodyActiveThreadsOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshActiveThreadsOverTime(true);
            }
            document.location.href="#activeThreadsOverTime";
        } else if (elem.id == "bodyTimeVsThreads") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshTimeVsThreads();
            }
            document.location.href="#timeVsThreads" ;
        } else if (elem.id == "bodyCodesPerSecond") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshCodesPerSecond(true);
            }
            document.location.href="#codesPerSecond";
        } else if (elem.id == "bodyTransactionsPerSecond") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshTransactionsPerSecond(true);
            }
            document.location.href="#transactionsPerSecond";
        } else if (elem.id == "bodyTotalTPS") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshTotalTPS(true);
            }
            document.location.href="#totalTPS";
        } else if (elem.id == "bodyResponseTimeVsRequest") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimeVsRequest();
            }
            document.location.href="#responseTimeVsRequest";
        } else if (elem.id == "bodyLatenciesVsRequest") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshLatenciesVsRequest();
            }
            document.location.href="#latencyVsRequest";
        }
    }
}

/*
 * Activates or deactivates all series of the specified graph (represented by id parameter)
 * depending on checked argument.
 */
function toggleAll(id, checked){
    var placeholder = document.getElementById(id);

    var cases = $(placeholder).find(':checkbox');
    cases.prop('checked', checked);
    $(cases).parent().children().children().toggleClass("legend-disabled", !checked);

    var choiceContainer;
    if ( id == "choicesBytesThroughputOverTime"){
        choiceContainer = $("#choicesBytesThroughputOverTime");
        refreshBytesThroughputOverTime(false);
    } else if(id == "choicesResponseTimesOverTime"){
        choiceContainer = $("#choicesResponseTimesOverTime");
        refreshResponseTimeOverTime(false);
    }else if(id == "choicesResponseCustomGraph"){
        choiceContainer = $("#choicesResponseCustomGraph");
        refreshCustomGraph(false);
    } else if ( id == "choicesLatenciesOverTime"){
        choiceContainer = $("#choicesLatenciesOverTime");
        refreshLatenciesOverTime(false);
    } else if ( id == "choicesConnectTimeOverTime"){
        choiceContainer = $("#choicesConnectTimeOverTime");
        refreshConnectTimeOverTime(false);
    } else if ( id == "choicesResponseTimePercentilesOverTime"){
        choiceContainer = $("#choicesResponseTimePercentilesOverTime");
        refreshResponseTimePercentilesOverTime(false);
    } else if ( id == "choicesResponseTimePercentiles"){
        choiceContainer = $("#choicesResponseTimePercentiles");
        refreshResponseTimePercentiles();
    } else if(id == "choicesActiveThreadsOverTime"){
        choiceContainer = $("#choicesActiveThreadsOverTime");
        refreshActiveThreadsOverTime(false);
    } else if ( id == "choicesTimeVsThreads"){
        choiceContainer = $("#choicesTimeVsThreads");
        refreshTimeVsThreads();
    } else if ( id == "choicesSyntheticResponseTimeDistribution"){
        choiceContainer = $("#choicesSyntheticResponseTimeDistribution");
        refreshSyntheticResponseTimeDistribution();
    } else if ( id == "choicesResponseTimeDistribution"){
        choiceContainer = $("#choicesResponseTimeDistribution");
        refreshResponseTimeDistribution();
    } else if ( id == "choicesHitsPerSecond"){
        choiceContainer = $("#choicesHitsPerSecond");
        refreshHitsPerSecond(false);
    } else if(id == "choicesCodesPerSecond"){
        choiceContainer = $("#choicesCodesPerSecond");
        refreshCodesPerSecond(false);
    } else if ( id == "choicesTransactionsPerSecond"){
        choiceContainer = $("#choicesTransactionsPerSecond");
        refreshTransactionsPerSecond(false);
    } else if ( id == "choicesTotalTPS"){
        choiceContainer = $("#choicesTotalTPS");
        refreshTotalTPS(false);
    } else if ( id == "choicesResponseTimeVsRequest"){
        choiceContainer = $("#choicesResponseTimeVsRequest");
        refreshResponseTimeVsRequest();
    } else if ( id == "choicesLatencyVsRequest"){
        choiceContainer = $("#choicesLatencyVsRequest");
        refreshLatenciesVsRequest();
    }
    var color = checked ? "black" : "#818181";
    if(choiceContainer != null) {
        choiceContainer.find("label").each(function(){
            this.style.color = color;
        });
    }
}

