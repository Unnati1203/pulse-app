import { Client } from '@elastic/elasticsearch';

export const es = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  maxRetries: 1,
  requestTimeout: 1500,
});
