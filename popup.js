const currentYear = new Date().getFullYear();
let nextPageToken = null;
let loading = false;
let scrollPosition = 0;

document.getElementById('searchButton').addEventListener('click', () => {
  document.getElementById('results').innerHTML = '';
  nextPageToken = null;
  scrollPosition = 0;
  document.getElementById('quotaMessage').style.display = 'none';
  const searchButton = document.getElementById('searchButton');
  searchButton.classList.add('shake-intense');
  setTimeout(() => searchButton.classList.remove('shake-intense'), 600); // Remove the shake effect after animation duration
  searchVideos(true);
});

document.getElementById('closeButton').addEventListener('click', () => {
  browser.storage.local.remove(['searchParams', 'results', 'scrollPosition'], () => {
    window.close();
  });
});

document.getElementById('toTopButton').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function searchVideos(clearResults = false) {
  const beforeYear = document.getElementById('beforeYearInput').value || '';
  const afterYear = document.getElementById('afterYearInput').value || '';
  const keywords = document.getElementById('keywordsInput').value;
  const category = document.getElementById('categorySelect').value;
  const sort = document.getElementById('sortSelect').value;

  const searchParams = {
    beforeYear,
    afterYear,
    keywords,
    category,
    sort
  };

  browser.storage.local.set({ searchParams });

  const maxResults = 10;
  const apiKey = 'YOUR_API_KEY';
  const query = keywords || '';
  let url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=${maxResults}&order=${sort}`;

  if (beforeYear) {
    const publishedBefore = `${beforeYear}-01-01T00:00:00Z`;
    url += `&publishedBefore=${publishedBefore}`;
  }

  if (afterYear) {
    const publishedAfter = `${afterYear}-01-01T00:00:00Z`;
    url += `&publishedAfter=${publishedAfter}`;
  }

  if (category) {
    url += `&videoCategoryId=${category}`;
  }

  if (nextPageToken) {
    url += `&pageToken=${nextPageToken}`;
  }

  document.getElementById('loading').style.display = 'block';
  loading = true;

  fetch(url)
    .then(response => {
      if (response.status === 403) {
        throw new Error('Quota limit reached');
      }
      return response.json();
    })
    .then(data => {
      const resultsDiv = document.getElementById('results');
      document.getElementById('loading').style.display = 'none';
      loading = false;

      if (data.nextPageToken) {
        nextPageToken = data.nextPageToken;
      } else {
        nextPageToken = null;
      }

      const results = data.items.map(item => {
        const videoDiv = document.createElement('div');
        videoDiv.classList.add('video');

        const thumbnailLink = document.createElement('a');
        thumbnailLink.href = `https://www.youtube.com/watch?v=${item.id.videoId}`;
        thumbnailLink.target = '_blank';

        const thumbnail = document.createElement('img');
        thumbnail.src = item.snippet.thumbnails.default.url;
        thumbnail.classList.add('thumbnail');
        thumbnailLink.appendChild(thumbnail);
        videoDiv.appendChild(thumbnailLink);

        const title = document.createElement('a');
        title.href = `https://www.youtube.com/watch?v=${item.id.videoId}`;
        title.textContent = item.snippet.title;
        title.target = '_blank';
        title.classList.add('video-title');
        title.title = item.snippet.title;
        videoDiv.appendChild(title);

        const date = document.createElement('span');
        date.textContent = ` Upload: ${new Date(item.snippet.publishedAt).toLocaleDateString()}`;
        videoDiv.appendChild(date);

        const uploader = document.createElement('span');
        uploader.textContent = ` By: ${item.snippet.channelTitle}`;
        videoDiv.appendChild(uploader);

        fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${item.id.videoId}&key=${apiKey}`)
          .then(response => response.json())
          .then(statsData => {
            const views = document.createElement('span');
            views.textContent = ` Views: ${formatViewCount(statsData.items[0].statistics.viewCount)}`;
            videoDiv.appendChild(views);
          })
          .catch(error => console.error('Error fetching video stats:', error));

        resultsDiv.appendChild(videoDiv);
        return videoDiv.outerHTML;
      }).join('');

      if (clearResults) {
        browser.storage.local.set({ results });
      } else {
        browser.storage.local.get('results', data => {
          const currentResults = data.results || '';
          browser.storage.local.set({ results: currentResults + results });
        });
      }

      document.body.style.height = `${document.body.scrollHeight}px`;
    })
    .catch(error => {
      console.error('Error:', error);
      document.getElementById('loading').style.display = 'none';
      loading = false;
      if (error.message === 'Quota limit reached') {
        document.getElementById('quotaMessage').style.display = 'block';
      }
    });
}

function formatViewCount(viewCount) {
  if (viewCount >= 1000000) {
    return (viewCount / 1000000).toFixed(2) + 'M';
  } else if (viewCount >= 1000) {
    return (viewCount / 1000).toFixed(2) + 'K';
  } else {
    return viewCount;
  }
}

window.addEventListener('scroll', () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 10 && !loading && nextPageToken) {
    searchVideos();
  }
  browser.storage.local.set({ scrollPosition: window.scrollY });

  const searchButtonPosition = document.getElementById('searchButton').offsetTop;
  if (window.scrollY > searchButtonPosition) {
    document.getElementById('toTopButton').style.display = 'block';
  } else {
    document.getElementById('toTopButton').style.display = 'none';
  }
});

function restoreState() {
  browser.storage.local.get(['searchParams', 'results', 'scrollPosition'], (data) => {
    if (data.searchParams) {
      document.getElementById('beforeYearInput').value = data.searchParams.beforeYear || '';
      document.getElementById('afterYearInput').value = data.searchParams.afterYear || '';
      document.getElementById('keywordsInput').value = data.searchParams.keywords || '';
      document.getElementById('categorySelect').value = data.searchParams.category || '';
      document.getElementById('sortSelect').value = data.searchParams.sort || 'relevance';
    }

    if (data.results) {
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = data.results;
      document.body.style.height = `${document.body.scrollHeight}px`;
    }

    if (data.scrollPosition) {
      window.scrollTo(0, data.scrollPosition);
    }
  });
}

document.addEventListener('DOMContentLoaded', restoreState);
