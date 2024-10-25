// 添加自定义时间指示器
function addCustomTimeIndicator(calendar) {
  const timeIndicator = document.createElement('div');
  timeIndicator.className = 'custom-time-indicator';
  
  function updateTimeIndicator() {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = (minutes / 1440) * 100;
    timeIndicator.style.top = `${top}%`;
  }

  updateTimeIndicator();
  setInterval(updateTimeIndicator, 60000); // 每分钟更新一次

  const timeGrid = calendar.el.querySelector('.fc-timegrid-body');
  if (timeGrid) {
    timeGrid.appendChild(timeIndicator);
  }
}

// 滚动到当前时间
function scrollToCurrentTime() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const scrollPosition = (minutes / 1440) * document.querySelector('.fc-timegrid-body').scrollHeight;
  document.querySelector('.fc-scroller-liquid-absolute').scrollTop = scrollPosition;
}

// 初始化日历
function initializeCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) {
    console.error('Calendar element not found');
    return;
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    // 日历配置...
  });

  calendar.render();
  console.log('Calendar initialized:', calendar);

  addCustomTimeIndicator(calendar);
  scrollToCurrentTime();
}

// 确保在DOM加载完成后初始化日历
document.addEventListener('DOMContentLoaded', function() {
  initializeCalendar();
});

// 其他代码...

// 确保所有的事件监听器都在元素存在时才添加
document.addEventListener('DOMContentLoaded', function() {
  const someElement = document.getElementById('someElementId');
  if (someElement) {
    someElement.addEventListener('click', function() {
      // 事件处理逻辑...
    });
  } else {
    console.error('Element with id "someElementId" not found');
  }
});
