// Copyright © 2021 Kaleido, Inc.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { promises as fs } from 'fs';
import Ajv from 'ajv';
import configSchema from '../schemas/config.json';
import * as utils from './utils';
import { IConfig } from './interfaces';
import path from 'path';
import {Logger} from "./logger";

const log = new Logger('lib/config.ts')

const ajv = new Ajv();
const validateConfig = ajv.compile(configSchema);
const configFilePath = path.join(utils.constants.DATA_DIRECTORY, utils.constants.CONFIG_FILE_NAME);
const peersFilePath = path.join(utils.constants.DATA_DIRECTORY, utils.constants.PEERS_FILE_NAME);

export let config: IConfig;

export const init = async () => {
  await loadConfig();
};

const loadConfig = async () => {
  try {
    log.debug(`Reading config file ${configFilePath}`);
    const data = JSON.parse(await fs.readFile(configFilePath, 'utf8'));
    try {
      log.debug(`Reading peers file ${peersFilePath}`);
      data.peers = JSON.parse(await fs.readFile(peersFilePath, 'utf8'));
    } catch (err) {
      // if file does not exist, just set peers to either the peers from config.json (if migrating from older version) or to an empty list
      log.debug(`Error code when reading peers file ${err.code}`);
      if (err.code === 'ENOENT') {
        data.peers = data.peers || [];
      } else {
        throw err;
      }
    }
    if(validateConfig(data)) {
      config = data as IConfig;
      for(const peer of config.peers) {
        if(peer.endpoint.endsWith('/')) {
          peer.endpoint = peer.endpoint.slice(-0, -1);
        }
      }
    } else {
      throw new Error('Invalid configuration files');
    }
  } catch(err) {
    throw new Error(`Failed to read configuration files. ${err}`);
  }
};

export const persistPeers = async () => {
  await ensurePeersDirectoryExists();
  await fs.writeFile(peersFilePath, JSON.stringify(config.peers, null, 2));
};

const ensurePeersDirectoryExists = async () => {
  try {
    await fs.access(peersFilePath);
  } catch(err) {
    if(err.code === 'ENOENT') {
      await createPeersDirectory();
    } else {
      log.warn(`Could not check for existence of peers subdirectory ${err.code}`);
    }
  }
};

const createPeersDirectory = async () => {
  try {
    await fs.mkdir(path.parse(peersFilePath).dir, { recursive: true });
    log.info('Peers subdirectory created');
  } catch(err) {
    log.error(`Failed to create peers subdirectory ${err.code}`);
  }
};