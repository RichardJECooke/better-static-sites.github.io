# playwright browser server pinned to the client's version, so every host os/arch renders text identically
ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PLAYWRIGHT_VERSION

# inter stands in for san francisco and other system ui fonts; dejavu sans mono for menlo
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-inter fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
COPY fonts.conf /etc/fonts/local.conf
RUN fc-cache -f >/dev/null

RUN npm install -g playwright@${PLAYWRIGHT_VERSION} >/dev/null

ENV TZ=UTC
EXPOSE 3000
CMD ["playwright", "run-server", "--port", "3000", "--host", "0.0.0.0"]
