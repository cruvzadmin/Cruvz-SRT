FROM    ubuntu:22.04 AS base

## Install libraries by package
ENV     DEBIAN_FRONTEND=noninteractive
RUN     apt-get update && apt-get install -y tzdata sudo curl git

FROM    base AS build

WORKDIR /tmp

ARG     CS_VERSION=master
ARG 	STRIP=TRUE

ENV     PREFIX=/opt/cruvzstreaming
ENV     TEMP_DIR=/tmp/cs

## Download Cruvz Streaming
RUN \
        mkdir -p ${TEMP_DIR} && \
        cd ${TEMP_DIR} && \
        git clone --branch ${CS_VERSION} --single-branch --depth 1 https://github.com/techfixind/Cruvz-SRT .

## Install dependencies
RUN \
        ${TEMP_DIR}/misc/prerequisites.sh 

## Build Cruvz Streaming
RUN \
        cd ${TEMP_DIR}/src && \
        make release -j$(nproc)

RUN \
        if [ "$STRIP" = "TRUE" ] ; then strip ${TEMP_DIR}/src/bin/RELEASE/CruvzStreaming ; fi

## Make running environment
RUN \
        cd ${TEMP_DIR}/src && \
        mkdir -p ${PREFIX}/bin/origin_conf && \
        mkdir -p ${PREFIX}/bin/edge_conf && \
        cp ./bin/RELEASE/CruvzStreaming ${PREFIX}/bin/ && \
        cp ../misc/conf_examples/Origin.xml ${PREFIX}/bin/origin_conf/Server.xml && \
        cp ../misc/conf_examples/Logger.xml ${PREFIX}/bin/origin_conf/Logger.xml && \
        cp ../misc/conf_examples/Edge.xml ${PREFIX}/bin/edge_conf/Server.xml && \
        cp ../misc/conf_examples/Logger.xml ${PREFIX}/bin/edge_conf/Logger.xml && \
        cp ../misc/install_nvidia_driver.sh ${PREFIX}/bin/install_nvidia_driver.sh && \
        rm -rf ${TEMP_DIR}

FROM	base AS release

WORKDIR         /opt/cruvzstreaming/bin
EXPOSE          80/tcp 8080/tcp 8090/tcp 1935/tcp 3333/tcp 3334/tcp 4000-4005/udp 10000-10010/udp 9000/tcp
COPY            --from=build /opt/cruvzstreaming /opt/cruvzstreaming

# Default run as Origin mode
CMD             ["/opt/cruvzstreaming/bin/CruvzStreaming", "-c", "origin_conf"]
