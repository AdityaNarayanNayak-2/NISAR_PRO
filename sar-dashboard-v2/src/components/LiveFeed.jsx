import React from 'react';
import { motion } from 'framer-motion';
import '../App.css';

const LiveFeed = ({ jobs }) => {
    const formatJobId = (id) => `JOB-${String(id).padStart(4, '0')}`;

    return (
        <section className="live-feed-section" id="live-data">
            <div className="section-container">
                <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="section-title"
                >
                    LIVE OPERATIONS FEED
                </motion.h2>

                <div className="feed-grid">
                    {jobs.map((job, index) => (
                        <motion.div
                            key={job.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="feed-card"
                        >
                            <div className="feed-header">
                                <span className="feed-id">{formatJobId(job.id)}</span>
                                <span className={`feed-status ${job.status.toLowerCase()}`}>{job.status}</span>
                            </div>
                            <h3 className="feed-name">{job.name}</h3>
                            <div className="feed-progress-container">
                                <div className="feed-progress-bar">
                                    <div
                                        className="feed-progress-fill"
                                        style={{ width: `${job.progress}%` }}
                                    ></div>
                                </div>
                                <span className="feed-percentage">{job.progress}%</span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default LiveFeed;
