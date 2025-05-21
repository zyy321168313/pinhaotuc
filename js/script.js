 let originalImage = null;
  let originalCanvas = null;
  let splitCanvases = [];
  let composedCanvas = null;
  let composedInverted = false;
  let uploadedSplitImages = [];

  // 上传原图并显示预览
  document.getElementById('originalUpload').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      originalCanvas = document.createElement('canvas');
      originalCanvas.width = img.width;
      originalCanvas.height = img.height;
      const ctx = originalCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      showOriginalPreview(img);
    };
    img.src = URL.createObjectURL(file);
  });

  function showOriginalPreview(img) {
    const container = document.getElementById('previewOriginalContainer');
    container.innerHTML = "";
    const preview = document.createElement('img');
    preview.className = 'preview-img';
    preview.src = img.src;
    container.appendChild(preview);
  }

  // 反转 ImageData 颜色
  function invertImageData(imgData) {
    for(let i = 0; i < imgData.data.length; i += 4){
      imgData.data[i] = 255 - imgData.data[i];     // R
      imgData.data[i+1] = 255 - imgData.data[i+1]; // G
      imgData.data[i+2] = 255 - imgData.data[i+2]; // B
    }
  }

  // 随机拆分原图成像素团块，无重叠，团块数量和大小联动
  function splitImage() {
    if (!originalCanvas) {
      alert("请先上传原图");
      return;
    }
    const blockSize = parseInt(document.getElementById('blockSize').value);
    let splitCount = parseInt(document.getElementById('splitCount').value);
    if (blockSize <= 0 || splitCount <= 0) {
      alert("像素团块大小和拆分图片数量必须大于0");
      return;
    }

    const width = originalCanvas.width;
    const height = originalCanvas.height;
    const ctxOrig = originalCanvas.getContext('2d');
    const imgData = ctxOrig.getImageData(0, 0, width, height);

    const cols = Math.ceil(width / blockSize);
    const rows = Math.ceil(height / blockSize);
    const totalBlocks = cols * rows;

    if (splitCount > totalBlocks) {
      splitCount = totalBlocks;
      document.getElementById('splitCount').value = splitCount;
    }

    // 随机打乱所有团块索引
    let blockIndices = Array.from({length: totalBlocks}, (_, i) => i);
    shuffleArray(blockIndices);

    // 每张拆分图分配的团块数量
    const blocksPerSplit = Math.floor(totalBlocks / splitCount);
    const remainder = totalBlocks % splitCount;

    splitCanvases = [];
    for(let i = 0; i < splitCount; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      splitCanvases.push(canvas);
    }

    let start = 0;
    for(let i = 0; i < splitCount; i++){
      const count = blocksPerSplit + (i < remainder ? 1 : 0);
      const canvas = splitCanvases[i];
      const ctx = canvas.getContext('2d');
      for(let j = start; j < start + count; j++){
        const blockIndex = blockIndices[j];
        const col = blockIndex % cols;
        const row = Math.floor(blockIndex / cols);
        const sx = col * blockSize;
        const sy = row * blockSize;
        const sw = (sx + blockSize > width) ? (width - sx) : blockSize;
        const sh = (sy + blockSize > height) ? (height - sy) : blockSize;
        const blockData = getBlock(imgData, sx, sy, sw, sh, width);
        ctx.putImageData(blockData, sx, sy);
      }

 // 这里加水印，保证水印在图块之上
    //drawWatermark(ctx, canvas.width, canvas.height);

      start += count;
    }

    // 如果勾选了反转，先执行反转
    if(document.getElementById('invertSplitCheckbox').checked){
      invertAllSplit();
    }

    showSplitCanvases();
  }

  // 提取图像块数据
  function getBlock(imgData, sx, sy, sw, sh, fullWidth) {
    const blockData = new ImageData(sw, sh);
    for(let y = 0; y < sh; y++){
      for(let x = 0; x < sw; x++){
        const srcIdx = ((sy + y) * fullWidth + (sx + x)) * 4;
        const dstIdx = (y * sw + x) * 4;
        blockData.data[dstIdx] = imgData.data[srcIdx];
        blockData.data[dstIdx+1] = imgData.data[srcIdx+1];
        blockData.data[dstIdx+2] = imgData.data[srcIdx+2];
        blockData.data[dstIdx+3] = imgData.data[srcIdx+3];
      }
    }
    return blockData;
  }

  // 随机打乱数组
  function shuffleArray(arr) {
    for(let i = arr.length -1; i > 0; i--){
      const j = Math.floor(Math.random() * (i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // 显示拆分图预览
  function showSplitCanvases() {
    const container = document.getElementById('splitContainer');
    container.innerHTML = "";
    splitCanvases.forEach((canvas, i) => {
      // 1. 从 canvas 生成 dataURL
      const dataURL = canvas.toDataURL("image/png");
      // 2. 生成 img
      const img = document.createElement('img');
      img.src = dataURL;
      //用小图模式：
      img.className = 'preview-img';
      // 如果想用大图模式：
      //img.className = 'preview-large';
      container.appendChild(img);
    });
  }

  // 反转所有拆分图颜色（针对拆分图画布）
  function invertAllSplit(){
    if(splitCanvases.length === 0){
      alert("无拆分图可反转");
      return;
    }
    splitCanvases.forEach(canvas => {
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      invertImageData(imgData);
      ctx.putImageData(imgData, 0, 0);
    });
  }

  // 下载所有拆分图
  function downloadAllSplit() {
  if (splitCanvases.length === 0) {
    alert("没有拆分图可下载");
    return;
  }

  splitCanvases.forEach((canvas, i) => {
    setTimeout(() => {
      const link = document.createElement('a');
      link.download = `split_${i + 1}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }, i * 200); // 每个下载间隔 200ms，可根据需要调整
  });
}

  // 清空上传的原图和预览
  function clearOriginal() {
    originalImage = null;
    originalCanvas = null;
    document.getElementById('originalUpload').value = "";
    document.getElementById('previewOriginalContainer').innerHTML = "";
  }

  // 清空拆分图和预览
  function clearSplit() {
    splitCanvases = [];
    document.getElementById('splitContainer').innerHTML = "";
  }

  // 上传拆分图（多个）并预览
  document.getElementById('splitUploads').addEventListener('change', e => {
    const files = e.target.files;
    if (!files.length) return;
    uploadedSplitImages = [];
    const container = document.getElementById('previewSplitUploadsContainer');
    container.innerHTML = "";
    let loadedCount = 0;
    for(let i = 0; i < files.length; i++){
      const file = files[i];
      const img = new Image();
      img.onload = () => {
        uploadedSplitImages.push(img);
        const preview = document.createElement('img');
        preview.className = 'preview-img';
        preview.src = img.src;
        container.appendChild(preview);
        loadedCount++;
        if (loadedCount === files.length) {
          // 所有图片加载完成后可以做其他操作
        }
      };
      img.src = URL.createObjectURL(file);
    }
  });

  // 清空上传的拆分图和预览
  function clearUploadedSplits() {
    uploadedSplitImages = [];
    document.getElementById('splitUploads').value = "";
    document.getElementById('previewSplitUploadsContainer').innerHTML = "";
  }

  // 合成拆分图，支持正片叠底
  function composeImages() {
    if(uploadedSplitImages.length === 0){
      alert("请先上传拆分图");
      return;
    }
    const width = uploadedSplitImages[0].width;
    const height = uploadedSplitImages[0].height;
    // 创建合成canvas
    composedCanvas = document.createElement('canvas');
    composedCanvas.width = width;
    composedCanvas.height = height;
    const ctx = composedCanvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    const invertBeforeCompose = document.getElementById('invertSplitBeforeCompose').checked;

    // 正片叠底混合上传拆分图
    uploadedSplitImages.forEach(img => {
      if (invertBeforeCompose) {
        // 先绘制图像到临时canvas再反转再合成
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        let imgData = tempCtx.getImageData(0, 0, width, height);
        invertImageData(imgData);
        tempCtx.putImageData(imgData, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(tempCanvas, 0, 0);
      } else {
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img, 0, 0);
      }
    });

    ctx.globalCompositeOperation = 'source-over'; // 恢复默认

    composedInverted = false;

// 在所有合成绘制完后加水印
  //drawWatermark(ctx, composedCanvas.width, composedCanvas.height);

      const container = document.getElementById('composedContainer');
    container.innerHTML = "";
    const dataURL = composedCanvas.toDataURL("image/png");
    const img = document.createElement('img');
    img.src = dataURL;
    // 小图模式：
    // img.className = 'preview-img';
    // 大图模式：
    img.className = 'preview-large';
    container.appendChild(img);
}

  // 合成图反转颜色

function invertComposed(){
  if (!composedCanvas) {
    alert("请先合成图片");
    return;
  }

  // 1) 在 Canvas 上反转像素
  const ctx = composedCanvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, composedCanvas.width, composedCanvas.height);
  invertImageData(imgData);
  ctx.putImageData(imgData, 0, 0);

  // 2) 把更新后的 Canvas 导成 DataURL，替换到预览的 <img> 上
  const previewImg = document.querySelector('#composedContainer img');
  if (previewImg) {
    previewImg.src = composedCanvas.toDataURL("image/png");
  }
}

  // 下载合成图
  function downloadComposed(){
    if(!composedCanvas){
      alert("请先合成图片");
      return;
    }
    const link = document.createElement('a');
    link.download = 'composed.png';
    link.href = composedCanvas.toDataURL("image/png");
    link.click();
  }

  // 清空合成图
  function clearComposed(){
    composedCanvas = null;
    composedInverted = false;
    document.getElementById('composedContainer').innerHTML = "";
  }

  // 监听拆分图反转勾选框，动态反转所有拆分图
  document.getElementById('invertSplitCheckbox').addEventListener('change', e => {
    if(splitCanvases.length === 0) return;
    // 为了实现可切换反转，需要重新绘制拆分图原始状态再根据checkbox决定是否反转
    // 这里简单方案：拆分图重新拆分一次
    splitImage();
  });

function drawWatermark(ctx, width, height) {
  if (!ctx || width <= 0 || height <= 0) return;

  ctx.save();

  const fontSize = Math.max(12, Math.floor((height < width ? width : height) * 0.03)); // 字体大小基于高/宽度
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = "rgba(255, 0, 0, 0.4)"; // 半透明红色
  ctx.textAlign = "center";

  const topText = "作者 @ zyy321168313";
  const bottomText = "版权所有 © 2025 拼好图工具🛠";
  const leftText = "仅供学习交流";
  const rightText = "不得非法使用";

  const offset = fontSize * 1.2; // 四边边距

  // 顶部水印（横排）
  ctx.textBaseline = "top";
  ctx.fillText(topText, width / 2, offset);

  // 底部水印（横排）
  ctx.textBaseline = "bottom";
  ctx.fillText(bottomText, width / 2, height - offset);

  // 左侧水印（竖排 从上到下）
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const leftX = offset;
  const leftStartY = height / 2 - (leftText.length * fontSize) / 2;
  for (let i = 0; i < leftText.length; i++) {
    ctx.fillText(leftText[i], leftX, leftStartY + i * fontSize);
  }
  ctx.restore();

  // 右侧水印（竖排 从上到下）
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const rightX = width - offset;
  const rightStartY = height / 2 - (rightText.length * fontSize) / 2;
  for (let i = 0; i < rightText.length; i++) {
    ctx.fillText(rightText[i], rightX, rightStartY + i * fontSize);
  }
  ctx.restore();

  ctx.restore();
}

function showQR(method) {
  const qrModal = document.getElementById('qrModal');
  const qrImage = document.getElementById('qrImage');
  const qrTitle = document.getElementById('qrTitle');
  if (method === 'wechat') {
    qrTitle.textContent = '微信扫码赞赏';
    qrImage.src = 'assets/qr9f3a7b2c/WE.png';
  } else if (method === 'alipay') {
    qrTitle.textContent = '支付宝扫码赞赏';
    qrImage.src = 'assets/qr9f3a7b2c/ZH.png';
  } else {
    qrTitle.textContent = '银联扫码赞赏';
    qrImage.src = 'assets/qr9f3a7b2c/YI.png';
  }

  // **重置为模糊态**
  qrImage.classList.remove('unblur');

  qrModal.style.display = 'flex';
}

  function closeQR() {
    document.getElementById('qrModal').style.display = 'none';
  }

// 用户点击二维码本身，就去掉 blur
document.getElementById('qrImage').addEventListener('click', function() {
  this.classList.add('unblur');
});

document.getElementById('invertComposedCheckbox')
        .addEventListener('change', () => {
  if (!composedCanvas) {
    alert("请先合成图片");
    document.getElementById('invertComposedCheckbox').checked = false;
    return;
  }
  invertComposed();
});

document.addEventListener("DOMContentLoaded", function () {
    const selector = document.getElementById("fontSizeSelect");

    selector.addEventListener("change", function () {
      const selected = this.value;
      document.body.classList.remove("font-normal", "font-medium", "font-large", "font-xlarge");
      document.body.classList.add(`font-${selected}`);
    });

    // 设置默认字体样式
    document.body.classList.add("font-normal");
  });

